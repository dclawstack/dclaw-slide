from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.presentation import Presentation, Slide
from app.repositories.presentation_repo import PresentationRepository, SlideRepository
from app.schemas.presentation import PresentationRead, SlideRead
from app.services.ai import select_provider
from app.services.layout import pick_layout
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


class GenerateDeckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    presentation: PresentationRead
    provider: str


class SpeakerNotesRequest(BaseModel):
    save: bool = True


class SpeakerNotesResponse(BaseModel):
    slide: SlideRead
    notes: str
    likely_questions: list[str]
    provider: str


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

    presentation_repo = PresentationRepository(db)
    if payload.presentation_id is not None:
        presentation = await presentation_repo.get_with_slides(payload.presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="presentation not found")
    else:
        title = payload.title or payload.prompt.strip()[:80] or "Generated deck"
        presentation = await presentation_repo.create(
            Presentation(title=title, theme_id=payload.theme_id, template=payload.theme_id)
        )

    provider = await select_provider()
    try:
        generated = await provider.generate_deck(
            payload.prompt, payload.target_slides, payload.deck_type
        )
    except Exception as exc:  # network failure / bad JSON — never bubble up raw
        raise HTTPException(
            status_code=502,
            detail=f"AI provider '{provider.name}' failed: {exc}",
        )

    slide_repo = SlideRepository(db)
    if payload.replace_existing:
        for s in list(presentation.slides):
            await db.delete(s)
        await db.flush()
        start = 0
    else:
        start = await slide_repo.next_position(presentation.id)

    for offset, gen in enumerate(generated):
        # Critic step: heuristic layout picker overrides whatever the LLM chose.
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
    await db.commit()
    await db.refresh(presentation, ["slides"])
    return GenerateDeckResponse(
        presentation=PresentationRead.model_validate(presentation),
        provider=provider.name,
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

    return SpeakerNotesResponse(
        slide=SlideRead.model_validate(slide),
        notes=result.notes,
        likely_questions=result.likely_questions,
        provider=provider.name,
    )
