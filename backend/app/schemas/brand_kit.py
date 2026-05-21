from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


HEX = r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$"


class BrandKitUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    primary_color: str | None = Field(default=None, pattern=HEX)
    accent_color: str | None = Field(default=None, pattern=HEX)
    neutral_color: str | None = Field(default=None, pattern=HEX)
    font_heading: str | None = Field(default=None, max_length=128)
    font_body: str | None = Field(default=None, max_length=128)
    logo_url: str | None = Field(default=None, max_length=512)
    voice_dos: str | None = None
    voice_donts: str | None = None


class BrandKitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: str
    name: str
    primary_color: str
    accent_color: str
    neutral_color: str
    font_heading: str
    font_body: str
    logo_url: str
    voice_dos: str
    voice_donts: str
    created_at: datetime
    updated_at: datetime
