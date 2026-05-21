import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class SlideAnalyticsEvent(Base):
    __tablename__ = "slide_analytics_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    presentation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("presentations.id", ondelete="CASCADE"), index=True
    )
    slide_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("slides.id", ondelete="CASCADE"), nullable=True, index=True
    )
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    event_type: Mapped[str] = mapped_column(String(32), index=True)
    # slide_view | dwell | advance | back | dropoff | finish
    dwell_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
