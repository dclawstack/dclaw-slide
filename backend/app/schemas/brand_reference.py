from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BrandReferenceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    source_kind: str = Field(default="deck", max_length=32)


class BrandReferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: str
    title: str
    source_kind: str
    body: str
    created_at: datetime
    updated_at: datetime


class BrandReferenceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    source_kind: str
    body_chars: int
    created_at: datetime
