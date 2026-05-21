import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class BrandKit(Base):
    """One brand kit per workspace. Acts as a singleton — `workspace_id` is unique."""

    __tablename__ = "brand_kits"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="Untitled Brand")
    primary_color: Mapped[str] = mapped_column(String(16), default="#0F172A")
    accent_color: Mapped[str] = mapped_column(String(16), default="#EC4899")
    neutral_color: Mapped[str] = mapped_column(String(16), default="#F8FAFC")
    font_heading: Mapped[str] = mapped_column(String(128), default="Inter, system-ui, sans-serif")
    font_body: Mapped[str] = mapped_column(String(128), default="Inter, system-ui, sans-serif")
    logo_url: Mapped[str] = mapped_column(String(512), default="")
    voice_dos: Mapped[str] = mapped_column(Text, default="")
    voice_donts: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
