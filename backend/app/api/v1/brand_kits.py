from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.brand_kit_repo import BrandKitRepository
from app.schemas.brand_kit import BrandKitRead, BrandKitUpdate

router = APIRouter()


@router.get("", response_model=BrandKitRead)
async def get_brand_kit(
    workspace_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
) -> BrandKitRead:
    repo = BrandKitRepository(db)
    kit = await repo.get_or_create(workspace_id)
    return BrandKitRead.model_validate(kit)


@router.put("", response_model=BrandKitRead)
async def update_brand_kit(
    payload: BrandKitUpdate,
    workspace_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
) -> BrandKitRead:
    repo = BrandKitRepository(db)
    kit = await repo.get_or_create(workspace_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(kit, field, value)
    await db.commit()
    await db.refresh(kit)
    return BrandKitRead.model_validate(kit)
