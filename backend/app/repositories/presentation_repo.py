from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.presentation import Presentation, Slide
from app.repositories.base_repo import BaseRepository


class PresentationRepository(BaseRepository[Presentation]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Presentation)

    async def list_for_workspace(
        self, workspace_id: str, limit: int = 50, offset: int = 0
    ) -> tuple[list[Presentation], int]:
        result = await self.db.execute(
            select(Presentation)
            .where(Presentation.workspace_id == workspace_id)
            .order_by(Presentation.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items = list(result.scalars().all())
        total_result = await self.db.execute(
            select(Presentation).where(Presentation.workspace_id == workspace_id)
        )
        total = len(list(total_result.scalars().all()))
        return items, total

    async def get_with_slides(self, presentation_id: UUID) -> Presentation | None:
        return await self.get_by_id(presentation_id)


class SlideRepository(BaseRepository[Slide]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Slide)

    async def list_for_presentation(self, presentation_id: UUID) -> list[Slide]:
        result = await self.db.execute(
            select(Slide)
            .where(Slide.presentation_id == presentation_id)
            .order_by(Slide.position)
        )
        return list(result.scalars().all())

    async def next_position(self, presentation_id: UUID) -> int:
        existing = await self.list_for_presentation(presentation_id)
        return (max((s.position for s in existing), default=-1)) + 1

    async def replace_all(self, presentation_id: UUID, slides: list[Slide]) -> list[Slide]:
        existing = await self.list_for_presentation(presentation_id)
        for s in existing:
            await self.db.delete(s)
        for s in slides:
            self.db.add(s)
        await self.db.commit()
        return await self.list_for_presentation(presentation_id)
