import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session, get_db
from app.models.brand_reference import BrandReference
from app.models.presentation import Presentation, Slide
from app.repositories.presentation_repo import PresentationRepository, SlideRepository
from app.schemas.presentation import PresentationRead, SlideRead
from app.services.ai import select_provider
from app.services.ai.providers import DeterministicProvider, LLMProvider
from app.services.layout import pick_layout
from app.services.rag import format_for_prompt, rank
from app.services.realtime import manager as realtime
from app.services.themes import get_theme

router = APIRouter()


class GenerateDeckRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    target_slides: int = Field(default=8, ge=1, le=16)
    deck_type: str = Field(default="pitch", description="pitch | report | training")
    theme_id: str = Field(default="pitch-classic")
    title: str | None = Field(default=None, max_length=255)
    presentation_id: UUID | None = None
    replace_existing: bool = True
    use_brand_references: bool = True
    workspace_id: str = "default"


class GenerateDeckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    presentation: PresentationRead
    provider: str
    references_used: int


class SpeakerNotesRequest(BaseModel):
    save: bool = True


class SpeakerNotesResponse(BaseModel):
    slide: SlideRead
    notes: str
    likely_questions: list[str]
    provider: str


async def _load_or_create_deck(
    payload: GenerateDeckRequest, db: AsyncSession
) -> Presentation:
    repo = PresentationRepository(db)
    if payload.presentation_id is not None:
        presentation = await repo.get_with_slides(payload.presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="presentation not found")
        return presentation
    title = payload.title or payload.prompt.strip()[:80] or "Generated deck"
    return await repo.create(
        Presentation(title=title, theme_id=payload.theme_id, template=payload.theme_id)
    )


async def _build_enriched_prompt(
    payload: GenerateDeckRequest, db: AsyncSession
) -> tuple[str, int]:
    """Returns (prompt_to_send_to_llm, references_used)."""
    if not payload.use_brand_references:
        return payload.prompt, 0
    refs_result = await db.execute(
        select(BrandReference).where(BrandReference.workspace_id == payload.workspace_id)
    )
    hits = rank(payload.prompt, list(refs_result.scalars().all()))[:3]
    if not hits:
        return payload.prompt, 0
    # Order matters: examples first (sets the voice), then a forceful pivot
    # to the user's actual topic. Without the "DO NOT write about" guard,
    # small models drift onto the reference content. Final prompt repeats the
    # topic so it's the LAST thing the model reads before generating.
    enriched = (
        f"{format_for_prompt(hits)}\n\n"
        f"=========\n"
        f"WRITE A DECK ABOUT THIS TOPIC AND THIS TOPIC ONLY:\n\n"
        f"    {payload.prompt}\n\n"
        f"Do NOT write about the style examples above. They are only here to "
        f"show you our tone of voice. Every slide must be about: {payload.prompt}"
    )
    return enriched, len(hits)


async def _pad_to_target(
    generated: list, target: int, prompt: str, deck_type: str
) -> list:
    """Small models (gemma4:e2b) sometimes return fewer slides than asked,
    even after EXACT-COUNT instructions. Pad with deterministic template
    slides so the user always gets the deck length they requested. The
    template continues the section progression the user implicitly asked
    for (Hook → Problem → Solution → …)."""
    if len(generated) >= target:
        return list(generated[:target])
    deterministic = DeterministicProvider()
    template_slides = await deterministic.generate_deck(prompt, target, deck_type)
    return list(generated) + list(template_slides[len(generated):target])


async def _persist_generated_slides(
    presentation: Presentation,
    generated: list,
    replace_existing: bool,
    db: AsyncSession,
) -> None:
    if replace_existing:
        for s in list(presentation.slides):
            await db.delete(s)
        await db.flush()
        start = 0
    else:
        start = await SlideRepository(db).next_position(presentation.id)
    for offset, gen in enumerate(generated):
        # Critic step: heuristic picker overrides whatever the LLM chose.
        layout = pick_layout(gen.title, gen.body, gen.layout)
        db.add(
            Slide(
                presentation_id=presentation.id,
                position=start + offset,
                title=gen.title,
                body=gen.body,
                layout=layout,
            )
        )


@router.post(
    "/generate-deck",
    response_model=GenerateDeckResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_deck(
    payload: GenerateDeckRequest, db: AsyncSession = Depends(get_db)
) -> GenerateDeckResponse:
    if get_theme(payload.theme_id) is None:
        raise HTTPException(status_code=400, detail=f"unknown theme_id: {payload.theme_id}")
    presentation = await _load_or_create_deck(payload, db)
    enriched_prompt, references_used = await _build_enriched_prompt(payload, db)
    provider = await select_provider()
    try:
        generated = await provider.generate_deck(
            enriched_prompt, payload.target_slides, payload.deck_type
        )
    except Exception as exc:  # network failure / bad JSON — never bubble up raw
        raise HTTPException(
            status_code=502, detail=f"AI provider '{provider.name}' failed: {exc}"
        )
    # Top up if the model under-delivered (small models occasionally do).
    generated = await _pad_to_target(
        generated, payload.target_slides, payload.prompt, payload.deck_type
    )
    await _persist_generated_slides(presentation, generated, payload.replace_existing, db)
    await db.commit()
    await db.refresh(presentation, ["slides"])
    await realtime.notify_invalidate(presentation.id, "ai_generated")
    return GenerateDeckResponse(
        presentation=PresentationRead.model_validate(presentation),
        provider=provider.name,
        references_used=references_used,
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/generate-deck-stream")
async def generate_deck_stream(
    payload: GenerateDeckRequest, db: AsyncSession = Depends(get_db)
) -> StreamingResponse:
    """Server-Sent Events variant of generate-deck. Emits one `slide` event per
    slide as it's generated, followed by a final `done` event. Each `slide`
    event is persisted to the DB so refreshing /p/[id] mid-stream shows the
    slides that already arrived.
    """
    if get_theme(payload.theme_id) is None:
        raise HTTPException(status_code=400, detail=f"unknown theme_id: {payload.theme_id}")
    presentation = await _load_or_create_deck(payload, db)
    enriched_prompt, references_used = await _build_enriched_prompt(payload, db)
    provider = await select_provider()

    # Clear existing slides up-front so the client doesn't see stale ones.
    if payload.replace_existing and presentation.slides:
        for s in list(presentation.slides):
            await db.delete(s)
        await db.commit()
        await db.refresh(presentation, ["slides"])
    start_position = (
        0 if payload.replace_existing
        else await SlideRepository(db).next_position(presentation.id)
    )
    # Capture the id now; the request-scoped `db`/`presentation` are closed once
    # the route returns, so the generator below must NOT reuse them.
    presentation_id = presentation.id

    async def event_stream():
        # The SSE generator keeps running after the request returns, so it owns
        # a FRESH session for its whole lifetime instead of the request-scoped
        # one (which is already closed by the time slides stream out).
        async with async_session() as db:
            active: LLMProvider = provider
            yield _sse(
                "ready",
                {
                    "presentation_id": str(presentation_id),
                    "provider": active.name,
                    "references_used": references_used,
                },
            )
            position = start_position
            slides_emitted = 0

            async def _drive(p: LLMProvider):
                nonlocal position, slides_emitted
                async for gen in p.stream_generate_deck(
                    enriched_prompt, payload.target_slides, payload.deck_type
                ):
                    layout = pick_layout(gen.title, gen.body, gen.layout)
                    slide = Slide(
                        presentation_id=presentation_id,
                        position=position,
                        title=gen.title,
                        body=gen.body,
                        layout=layout,
                    )
                    db.add(slide)
                    await db.commit()
                    await db.refresh(slide)
                    yield _sse(
                        "slide",
                        {
                            "id": str(slide.id),
                            "position": slide.position,
                            "title": slide.title,
                            "body": slide.body,
                            "layout": slide.layout,
                        },
                    )
                    position += 1
                    slides_emitted += 1

            try:
                async for event in _drive(active):
                    yield event
            except Exception as exc:
                # If the LLM blew up BEFORE we emitted a single slide, fall back to
                # the deterministic provider so the user gets *some* deck instead
                # of a generic "Generation failed" toast. If slides already arrived
                # we surface the error since partial state is now persisted.
                if slides_emitted == 0 and not isinstance(active, DeterministicProvider):
                    yield _sse(
                        "warning",
                        {"message": f"{active.name} failed ({exc}); using template fallback."},
                    )
                    active = DeterministicProvider()
                    active.stream_delay_ms = 0  # the user has already been waiting
                    try:
                        async for event in _drive(active):
                            yield event
                    except Exception as exc2:
                        yield _sse("error", {"message": f"fallback also failed: {exc2}"})
                        return
                else:
                    yield _sse("error", {"message": f"{active.name}: {exc}"})
                    return

            # Top-up: if the LLM stopped short of the target, fill with deterministic
            # template slides so the user gets the deck length they asked for.
            if slides_emitted < payload.target_slides:
                deterministic = DeterministicProvider()
                deterministic.stream_delay_ms = 0
                template = await deterministic.generate_deck(
                    payload.prompt, payload.target_slides, payload.deck_type
                )
                for gen in template[slides_emitted:payload.target_slides]:
                    layout = pick_layout(gen.title, gen.body, gen.layout)
                    slide = Slide(
                        presentation_id=presentation_id,
                        position=position,
                        title=gen.title,
                        body=gen.body,
                        layout=layout,
                    )
                    db.add(slide)
                    await db.commit()
                    await db.refresh(slide)
                    yield _sse(
                        "slide",
                        {
                            "id": str(slide.id),
                            "position": slide.position,
                            "title": slide.title,
                            "body": slide.body,
                            "layout": slide.layout,
                        },
                    )
                    position += 1
                    slides_emitted += 1

            await realtime.notify_invalidate(presentation_id, "ai_generated")
            yield _sse(
                "done",
                {"presentation_id": str(presentation_id), "slides": slides_emitted},
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/speaker-notes/{slide_id}", response_model=SpeakerNotesResponse)
async def generate_speaker_notes(
    slide_id: UUID,
    payload: SpeakerNotesRequest = SpeakerNotesRequest(),
    db: AsyncSession = Depends(get_db),
) -> SpeakerNotesResponse:
    slide_repo = SlideRepository(db)
    slide = await slide_repo.get_by_id(slide_id)
    if slide is None:
        raise HTTPException(status_code=404, detail="slide not found")

    presentation_repo = PresentationRepository(db)
    deck = await presentation_repo.get_with_slides(slide.presentation_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="presentation not found")
    deck_context = (
        f"Deck title: {deck.title}. Theme: {deck.theme_id}. "
        f"Slide {slide.position + 1} of {len(deck.slides)}."
    )

    provider = await select_provider()
    try:
        result = await provider.generate_speaker_notes(slide.title, slide.body, deck_context)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI provider '{provider.name}' failed: {exc}",
        )

    if payload.save:
        slide.speaker_notes = result.notes
        await db.commit()
        await db.refresh(slide)
        await realtime.notify_invalidate(slide.presentation_id, "speaker_notes_updated")

    return SpeakerNotesResponse(
        slide=SlideRead.model_validate(slide),
        notes=result.notes,
        likely_questions=result.likely_questions,
        provider=provider.name,
    )
