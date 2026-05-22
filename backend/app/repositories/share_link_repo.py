from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.share_link import ShareLink
from app.repositories.base_repo import BaseRepository


class ShareLinkRepository(BaseRepository[ShareLink]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, ShareLink)

    async def get_for_presentation(self, presentation_id: UUID) -> ShareLink | None:
        result = await self.db.execute(
            select(ShareLink).where(ShareLink.presentation_id == presentation_id)
        )
        return result.scalar_one_or_none()

    async def get_by_token(self, token: str) -> ShareLink | None:
        result = await self.db.execute(
            select(ShareLink).where(ShareLink.token == token)
        )
        return result.scalar_one_or_none()

    async def create_safe(self, link: ShareLink) -> ShareLink:
        """Defence-in-depth wrapper around create().

        UNIQUE(presentation_id) collisions are rare in practice — share creation
        is a deliberate button click — but if two requests for the same deck
        race (double-click, retry storm, future automation), we don't want one
        to surface a 500. Catch and return whichever row won the insert.
        """
        try:
            return await self.create(link)
        except IntegrityError:
            await self.db.rollback()
            existing = await self.get_for_presentation(link.presentation_id)
            if existing is None:
                raise
            return existing
