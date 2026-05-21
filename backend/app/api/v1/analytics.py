from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.analytics import SlideAnalyticsEvent
from app.models.presentation import Presentation, Slide
from app.repositories.presentation_repo import PresentationRepository
from app.schemas.analytics import (
    ALLOWED_EVENTS,
    AnalyticsEventCreate,
    AnalyticsEventRead,
    AnalyticsSummary,
    SlideStat,
)

router = APIRouter()


@router.post(
    "/{presentation_id}/analytics/event",
    response_model=AnalyticsEventRead,
    status_code=status.HTTP_201_CREATED,
)
async def record_event(
    presentation_id: UUID,
    payload: AnalyticsEventCreate,
    db: AsyncSession = Depends(get_db),
) -> AnalyticsEventRead:
    if payload.event_type not in ALLOWED_EVENTS:
        raise HTTPException(
            status_code=400,
            detail=f"unknown event_type; allowed: {sorted(ALLOWED_EVENTS)}",
        )
    repo = PresentationRepository(db)
    presentation = await repo.get_with_slides(presentation_id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="presentation not found")

    if payload.slide_id is not None and not any(
        s.id == payload.slide_id for s in presentation.slides
    ):
        raise HTTPException(status_code=400, detail="slide_id does not belong to presentation")

    event = SlideAnalyticsEvent(
        presentation_id=presentation_id,
        slide_id=payload.slide_id,
        session_id=payload.session_id,
        event_type=payload.event_type,
        dwell_ms=payload.dwell_ms,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return AnalyticsEventRead.model_validate(event)


@router.get(
    "/{presentation_id}/analytics/summary",
    response_model=AnalyticsSummary,
)
async def analytics_summary(
    presentation_id: UUID, db: AsyncSession = Depends(get_db)
) -> AnalyticsSummary:
    repo = PresentationRepository(db)
    presentation = await repo.get_with_slides(presentation_id)
    if presentation is None:
        raise HTTPException(status_code=404, detail="presentation not found")

    events_result = await db.execute(
        select(SlideAnalyticsEvent).where(
            SlideAnalyticsEvent.presentation_id == presentation_id
        )
    )
    events = list(events_result.scalars().all())

    by_slide: dict[UUID, list[SlideAnalyticsEvent]] = {}
    sessions: set[str] = set()
    for event in events:
        sessions.add(event.session_id)
        if event.slide_id is not None:
            by_slide.setdefault(event.slide_id, []).append(event)

    stats: list[SlideStat] = []
    for slide in presentation.slides:
        slide_events = by_slide.get(slide.id, [])
        views = sum(1 for e in slide_events if e.event_type == "slide_view")
        dwell_events = [e for e in slide_events if e.dwell_ms > 0]
        total_dwell = sum(e.dwell_ms for e in dwell_events)
        avg_dwell = (total_dwell // len(dwell_events)) if dwell_events else 0
        dropoffs = sum(1 for e in slide_events if e.event_type == "dropoff")
        stats.append(
            SlideStat(
                slide_id=slide.id,
                position=slide.position,
                title=slide.title,
                views=views,
                total_dwell_ms=total_dwell,
                average_dwell_ms=avg_dwell,
                dropoffs=dropoffs,
            )
        )

    finishes = sum(1 for e in events if e.event_type == "finish")
    completion = (finishes / len(sessions)) if sessions else 0.0

    return AnalyticsSummary(
        presentation_id=presentation_id,
        total_sessions=len(sessions),
        total_events=len(events),
        completion_rate=round(completion, 3),
        slides=stats,
    )
