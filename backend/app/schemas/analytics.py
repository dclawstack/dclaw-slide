from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


EventType = str  # "slide_view" | "dwell" | "advance" | "back" | "dropoff" | "finish"
ALLOWED_EVENTS = {"slide_view", "dwell", "advance", "back", "dropoff", "finish"}


class AnalyticsEventCreate(BaseModel):
    slide_id: UUID | None = None
    session_id: str = Field(min_length=1, max_length=64)
    event_type: str = Field(min_length=1, max_length=32)
    dwell_ms: int = Field(default=0, ge=0, le=24 * 60 * 60 * 1000)


class AnalyticsEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    presentation_id: UUID
    slide_id: UUID | None
    session_id: str
    event_type: str
    dwell_ms: int
    created_at: datetime


class SlideStat(BaseModel):
    slide_id: UUID
    position: int
    title: str
    views: int
    total_dwell_ms: int
    average_dwell_ms: int
    dropoffs: int


class AnalyticsSummary(BaseModel):
    presentation_id: UUID
    total_sessions: int
    total_events: int
    completion_rate: float  # 0..1, finish / sessions
    slides: list[SlideStat]
