from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.utils import utc_now
from app.models.share_link import ShareLink
from app.repositories.presentation_repo import PresentationRepository
from app.repositories.share_link_repo import ShareLinkRepository
from app.schemas.presentation import PresentationRead
from app.schemas.share_link import (
    PublicShareResponse,
    ShareLinkCreate,
    ShareLinkRead,
)
from app.services.share import hash_password, new_token, verify_password

router = APIRouter()


def _to_read(link: ShareLink) -> ShareLinkRead:
    return ShareLinkRead(
        id=link.id,
        presentation_id=link.presentation_id,
        token=link.token,
        allow_edit=link.allow_edit,
        expires_at=link.expires_at,
        has_password=bool(link.password_hash),
        view_count=link.view_count,
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


# ── Owner-side endpoints, nested under presentations ──────────────────────────

owner_router = APIRouter()


@owner_router.get("/{presentation_id}/share", response_model=ShareLinkRead | None)
async def get_share_link(
    presentation_id: UUID, db: AsyncSession = Depends(get_db)
) -> ShareLinkRead | None:
    link = await ShareLinkRepository(db).get_for_presentation(presentation_id)
    return _to_read(link) if link else None


@owner_router.post(
    "/{presentation_id}/share",
    response_model=ShareLinkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_rotate_share_link(
    presentation_id: UUID,
    payload: ShareLinkCreate,
    db: AsyncSession = Depends(get_db),
) -> ShareLinkRead:
    if await PresentationRepository(db).get_with_slides(presentation_id) is None:
        raise HTTPException(status_code=404, detail="presentation not found")

    expires = (
        utc_now() + timedelta(days=payload.expires_in_days)
        if payload.expires_in_days
        else None
    )

    repo = ShareLinkRepository(db)
    existing = await repo.get_for_presentation(presentation_id)

    if existing is None:
        link = ShareLink(
            presentation_id=presentation_id,
            token=new_token(),
            password_hash=hash_password(payload.password),
            allow_edit=payload.allow_edit,
            expires_at=expires,
        )
        db.add(link)
    else:
        existing.token = new_token()
        existing.password_hash = hash_password(payload.password)
        existing.allow_edit = payload.allow_edit
        existing.expires_at = expires
        link = existing

    await db.commit()
    await db.refresh(link)
    return _to_read(link)


@owner_router.delete(
    "/{presentation_id}/share", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_share_link(
    presentation_id: UUID, db: AsyncSession = Depends(get_db)
) -> None:
    repo = ShareLinkRepository(db)
    link = await repo.get_for_presentation(presentation_id)
    if link is None:
        raise HTTPException(status_code=404, detail="no share link")
    await repo.delete(link)


# ── Public, token-keyed endpoint ──────────────────────────────────────────────


async def _load_active_link(token: str, db: AsyncSession) -> ShareLink:
    link = await ShareLinkRepository(db).get_by_token(token)
    if link is None:
        raise HTTPException(status_code=404, detail="link not found")
    if link.expires_at is not None and link.expires_at < utc_now():
        raise HTTPException(status_code=410, detail="link expired")
    return link


@router.get("/{token}", response_model=PublicShareResponse)
async def public_view(
    token: str,
    x_share_password: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> PublicShareResponse:
    link = await _load_active_link(token, db)
    if not verify_password(x_share_password or "", link.password_hash):
        raise HTTPException(status_code=401, detail="password required or incorrect")

    repo = PresentationRepository(db)
    presentation = await repo.get_with_slides(link.presentation_id)
    if presentation is None:
        # presentation was deleted; cascade should have killed the link too, but be safe.
        raise HTTPException(status_code=404, detail="presentation no longer exists")

    link.view_count += 1
    await db.commit()

    return PublicShareResponse(
        presentation=PresentationRead.model_validate(presentation),
        allow_edit=link.allow_edit,
        expires_at=link.expires_at,
    )
