from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.presentation import PresentationRead


class ShareLinkCreate(BaseModel):
    password: str = Field(default="", max_length=128)
    allow_edit: bool = False
    expires_in_days: int | None = Field(default=None, ge=1, le=365)


class ShareLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    presentation_id: UUID
    token: str
    allow_edit: bool
    expires_at: datetime | None
    has_password: bool
    view_count: int
    created_at: datetime
    updated_at: datetime


class PublicShareResponse(BaseModel):
    presentation: PresentationRead
    allow_edit: bool
    expires_at: datetime | None
