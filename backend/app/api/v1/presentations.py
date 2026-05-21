from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.presentation import Presentation, Slide
from app.repositories.presentation_repo import PresentationRepository, SlideRepository
from app.schemas.presentation import (
    OutlineRequest,
    PresentationCreate,
    PresentationRead,
    PresentationSummary,
    PresentationUpdate,
    ReorderRequest,
    SlideCreate,
    SlideRead,
    SlideUpdate,
)
from app.services.outline import parse_outline
from app.services.themes import get_theme

router = APIRouter()


async def _load_presentation(presentation_id: UUID, db: AsyncSession) -> Presentation:
    repo = PresentationRepository(db)
    presentation = await repo.get_with_slides(presentation_id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="presentation not found")
    return presentation


@router.get("", response_model=list[PresentationSummary])
async def list_presentations(
    workspace_id: str = Query(default="default"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[PresentationSummary]:
    repo = PresentationRepository(db)
    items, _ = await repo.list_for_workspace(workspace_id, limit=limit, offset=offset)
    return [
        PresentationSummary(
            id=p.id,
            title=p.title,
            template=p.template,
            theme_id=p.theme_id,
            status=p.status,
            slide_count=len(p.slides),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in items
    ]


@router.post("", response_model=PresentationRead, status_code=status.HTTP_201_CREATED)
async def create_presentation(
    payload: PresentationCreate, db: AsyncSession = Depends(get_db)
) -> PresentationRead:
    if get_theme(payload.theme_id) is None:
        raise HTTPException(status_code=400, detail=f"unknown theme_id: {payload.theme_id}")
    repo = PresentationRepository(db)
    presentation = Presentation(
        title=payload.title,
        template=payload.template,
        theme_id=payload.theme_id,
        workspace_id=payload.workspace_id,
    )
    created = await repo.create(presentation)
    return PresentationRead.model_validate(created)


@router.get("/{presentation_id}", response_model=PresentationRead)
async def get_presentation(
    presentation_id: UUID, db: AsyncSession = Depends(get_db)
) -> PresentationRead:
    presentation = await _load_presentation(presentation_id, db)
    return PresentationRead.model_validate(presentation)


@router.patch("/{presentation_id}", response_model=PresentationRead)
async def update_presentation(
    presentation_id: UUID,
    payload: PresentationUpdate,
    db: AsyncSession = Depends(get_db),
) -> PresentationRead:
    presentation = await _load_presentation(presentation_id, db)
    updates = payload.model_dump(exclude_unset=True)
    if "theme_id" in updates and get_theme(updates["theme_id"]) is None:
        raise HTTPException(status_code=400, detail=f"unknown theme_id: {updates['theme_id']}")
    for field, value in updates.items():
        setattr(presentation, field, value)
    await db.commit()
    await db.refresh(presentation)
    return PresentationRead.model_validate(presentation)


@router.delete("/{presentation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_presentation(
    presentation_id: UUID, db: AsyncSession = Depends(get_db)
) -> None:
    presentation = await _load_presentation(presentation_id, db)
    repo = PresentationRepository(db)
    await repo.delete(presentation)


@router.get("/{presentation_id}/slides", response_model=list[SlideRead])
async def list_slides(
    presentation_id: UUID, db: AsyncSession = Depends(get_db)
) -> list[SlideRead]:
    await _load_presentation(presentation_id, db)
    repo = SlideRepository(db)
    slides = await repo.list_for_presentation(presentation_id)
    return [SlideRead.model_validate(s) for s in slides]


@router.post(
    "/{presentation_id}/slides",
    response_model=SlideRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_slide(
    presentation_id: UUID,
    payload: SlideCreate,
    db: AsyncSession = Depends(get_db),
) -> SlideRead:
    await _load_presentation(presentation_id, db)
    slide_repo = SlideRepository(db)
    position = (
        payload.position if payload.position is not None else await slide_repo.next_position(presentation_id)
    )
    slide = Slide(
        presentation_id=presentation_id,
        position=position,
        layout=payload.layout,
        title=payload.title,
        body=payload.body,
        speaker_notes=payload.speaker_notes,
    )
    created = await slide_repo.create(slide)
    return SlideRead.model_validate(created)


@router.patch("/{presentation_id}/slides/{slide_id}", response_model=SlideRead)
async def update_slide(
    presentation_id: UUID,
    slide_id: UUID,
    payload: SlideUpdate,
    db: AsyncSession = Depends(get_db),
) -> SlideRead:
    slide_repo = SlideRepository(db)
    slide = await slide_repo.get_by_id(slide_id)
    if slide is None or slide.presentation_id != presentation_id:
        raise HTTPException(status_code=404, detail="slide not found")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(slide, field, value)
    await db.commit()
    await db.refresh(slide)
    return SlideRead.model_validate(slide)


@router.delete(
    "/{presentation_id}/slides/{slide_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_slide(
    presentation_id: UUID, slide_id: UUID, db: AsyncSession = Depends(get_db)
) -> None:
    slide_repo = SlideRepository(db)
    slide = await slide_repo.get_by_id(slide_id)
    if slide is None or slide.presentation_id != presentation_id:
        raise HTTPException(status_code=404, detail="slide not found")
    await slide_repo.delete(slide)


@router.post(
    "/{presentation_id}/slides/reorder", response_model=list[SlideRead]
)
async def reorder_slides(
    presentation_id: UUID,
    payload: ReorderRequest,
    db: AsyncSession = Depends(get_db),
) -> list[SlideRead]:
    slide_repo = SlideRepository(db)
    existing = await slide_repo.list_for_presentation(presentation_id)
    existing_by_id = {s.id: s for s in existing}
    if set(payload.slide_ids) != set(existing_by_id.keys()):
        raise HTTPException(
            status_code=400,
            detail="reorder payload must include every existing slide_id exactly once",
        )
    for new_position, slide_id in enumerate(payload.slide_ids):
        existing_by_id[slide_id].position = new_position
    await db.commit()
    refreshed = await slide_repo.list_for_presentation(presentation_id)
    return [SlideRead.model_validate(s) for s in refreshed]


@router.post(
    "/{presentation_id}/outline",
    response_model=PresentationRead,
    status_code=status.HTTP_200_OK,
)
async def apply_outline(
    presentation_id: UUID,
    payload: OutlineRequest,
    db: AsyncSession = Depends(get_db),
) -> PresentationRead:
    presentation = await _load_presentation(presentation_id, db)
    parsed = parse_outline(payload.outline)
    slide_repo = SlideRepository(db)

    if payload.replace_existing:
        for s in list(presentation.slides):
            await db.delete(s)
        await db.flush()
        start_position = 0
    else:
        start_position = await slide_repo.next_position(presentation_id)

    for offset, draft in enumerate(parsed):
        db.add(
            Slide(
                presentation_id=presentation_id,
                position=start_position + offset,
                title=draft.title,
                body=draft.body,
                layout=draft.layout,
            )
        )
    await db.commit()
    await db.refresh(presentation, ["slides"])
    return PresentationRead.model_validate(presentation)
