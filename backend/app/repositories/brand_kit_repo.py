from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_kit import BrandKit
from app.repositories.base_repo import BaseRepository


class BrandKitRepository(BaseRepository[BrandKit]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, BrandKit)

    async def get_for_workspace(self, workspace_id: str) -> BrandKit | None:
        result = await self.db.execute(
            select(BrandKit).where(BrandKit.workspace_id == workspace_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, workspace_id: str) -> BrandKit:
        existing = await self.get_for_workspace(workspace_id)
        if existing is not None:
            return existing
        kit = BrandKit(workspace_id=workspace_id)
        return await self.create(kit)
