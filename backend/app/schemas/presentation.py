from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SlideBase(BaseModel):
    title: str = ""
    body: str = ""
    layout: str = "title-bullets"
    speaker_notes: str = ""


class SlideCreate(SlideBase):
    position: int | None = None


class SlideUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    layout: str | None = None
    speaker_notes: str | None = None
    position: int | None = None


class SlideRead(SlideBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    presentation_id: UUID
    position: int
    created_at: datetime
    updated_at: datetime


class PresentationBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    template: str = "pitch-classic"
    theme_id: str = "pitch-classic"


class PresentationCreate(PresentationBase):
    workspace_id: str = "default"


class PresentationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    template: str | None = None
    theme_id: str | None = None
    status: str | None = None


class PresentationRead(PresentationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    slides: list[SlideRead] = []


class PresentationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    template: str
    theme_id: str
    status: str
    slide_count: int
    created_at: datetime
    updated_at: datetime


class OutlineRequest(BaseModel):
    outline: str = Field(min_length=1, description="Markdown outline. Each H1 is a slide; bullets become body.")
    replace_existing: bool = True


class ReorderRequest(BaseModel):
    slide_ids: list[UUID]
