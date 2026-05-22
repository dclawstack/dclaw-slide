from uuid import UUID

from sqlalchemy import select
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
