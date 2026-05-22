import pytest

from app.services.share import hash_password, verify_password


def test_password_hash_roundtrip():
    h = hash_password("hunter2")
    assert h.startswith("$pbkdf2_sha256$")
    assert verify_password("hunter2", h)
    assert not verify_password("wrong", h)


def test_empty_hash_accepts_anything():
    assert verify_password("", "")
    assert verify_password("xx", "")


def test_malformed_hash_rejects():
    assert not verify_password("any", "garbage")


@pytest.mark.asyncio
async def test_share_link_lifecycle(client):
    created = await client.post("/api/v1/presentations", json={"title": "Share"})
    pid = created.json()["id"]

    # No link initially
    none_resp = await client.get(f"/api/v1/presentations/{pid}/share")
    assert none_resp.status_code == 200
    assert none_resp.json() is None

    # Create
    create_resp = await client.post(
        f"/api/v1/presentations/{pid}/share",
        json={"password": "", "expires_in_days": 7},
    )
    assert create_resp.status_code == 201
    link = create_resp.json()
    assert link["has_password"] is False
    assert link["expires_at"] is not None
    token = link["token"]

    # Public access without password works
    public = await client.get(f"/api/v1/share/{token}")
    assert public.status_code == 200
    assert public.json()["presentation"]["id"] == pid

    # View count incremented
    fetched = await client.get(f"/api/v1/presentations/{pid}/share")
    assert fetched.json()["view_count"] == 1


@pytest.mark.asyncio
async def test_share_link_with_password(client):
    created = await client.post("/api/v1/presentations", json={"title": "Locked"})
    pid = created.json()["id"]

    create_resp = await client.post(
        f"/api/v1/presentations/{pid}/share",
        json={"password": "open-sesame"},
    )
    token = create_resp.json()["token"]
    assert create_resp.json()["has_password"] is True

    # No password header → 401
    no_pw = await client.get(f"/api/v1/share/{token}")
    assert no_pw.status_code == 401

    # Wrong password → 401
    wrong = await client.get(
        f"/api/v1/share/{token}", headers={"X-Share-Password": "nope"}
    )
    assert wrong.status_code == 401

    # Right password → 200
    ok = await client.get(
        f"/api/v1/share/{token}", headers={"X-Share-Password": "open-sesame"}
    )
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_share_link_rotated_on_recreate(client):
    created = await client.post("/api/v1/presentations", json={"title": "Rotate"})
    pid = created.json()["id"]
    first = (
        await client.post(f"/api/v1/presentations/{pid}/share", json={})
    ).json()["token"]
    second = (
        await client.post(f"/api/v1/presentations/{pid}/share", json={})
    ).json()["token"]
    assert first != second

    # First token is dead
    assert (await client.get(f"/api/v1/share/{first}")).status_code == 404


@pytest.mark.asyncio
async def test_share_repo_recovers_from_concurrent_create(client):
    """If two POST /share requests race, the loser of UNIQUE(presentation_id)
    must converge on the winner's row instead of surfacing a 500."""
    import asyncio

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.share_link import ShareLink
    from app.repositories.share_link_repo import ShareLinkRepository
    from app.services.share import new_token
    from tests.conftest import test_engine

    from uuid import UUID
    created = await client.post("/api/v1/presentations", json={"title": "Race"})
    pid = UUID(created.json()["id"])

    async def _create() -> ShareLink:
        async with AsyncSession(test_engine, expire_on_commit=False) as session:
            return await ShareLinkRepository(session).create_safe(
                ShareLink(presentation_id=pid, token=new_token())
            )

    first, second = await asyncio.gather(_create(), _create())
    assert first.id == second.id  # both observers converged on the same row


@pytest.mark.asyncio
async def test_share_link_revoke(client):
    created = await client.post("/api/v1/presentations", json={"title": "Revoke"})
    pid = created.json()["id"]
    token = (
        await client.post(f"/api/v1/presentations/{pid}/share", json={})
    ).json()["token"]
    assert (await client.delete(f"/api/v1/presentations/{pid}/share")).status_code == 204
    assert (await client.get(f"/api/v1/share/{token}")).status_code == 404
