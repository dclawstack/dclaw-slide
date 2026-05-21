from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.brand_reference import BrandReference
from app.schemas.brand_reference import (
    BrandReferenceCreate,
    BrandReferenceRead,
    BrandReferenceSummary,
)

router = APIRouter()


@router.get("", response_model=list[BrandReferenceSummary])
async def list_references(
    workspace_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
) -> list[BrandReferenceSummary]:
    result = await db.execute(
        select(BrandReference)
        .where(BrandReference.workspace_id == workspace_id)
        .order_by(BrandReference.created_at.desc())
    )
    items = list(result.scalars().all())
    return [
        BrandReferenceSummary(
            id=r.id,
            title=r.title,
            source_kind=r.source_kind,
            body_chars=len(r.body),
            created_at=r.created_at,
        )
        for r in items
    ]


@router.post("", response_model=BrandReferenceRead, status_code=status.HTTP_201_CREATED)
async def create_reference(
    payload: BrandReferenceCreate,
    workspace_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
) -> BrandReferenceRead:
    ref = BrandReference(
        workspace_id=workspace_id,
        title=payload.title,
        body=payload.body,
        source_kind=payload.source_kind,
    )
    db.add(ref)
    await db.commit()
    await db.refresh(ref)
    return BrandReferenceRead.model_validate(ref)


@router.delete("/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reference(
    reference_id: UUID, db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(
        select(BrandReference).where(BrandReference.id == reference_id)
    )
    ref = result.scalar_one_or_none()
    if ref is None:
        raise HTTPException(status_code=404, detail="reference not found")
    await db.delete(ref)
    await db.commit()
