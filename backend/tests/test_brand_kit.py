import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_kit import BrandKit
from app.repositories.brand_kit_repo import BrandKitRepository
from tests.conftest import test_engine


@pytest.mark.asyncio
async def test_brand_kit_autocreates_with_defaults(client):
    response = await client.get("/api/v1/brand-kit")
    assert response.status_code == 200
    kit = response.json()
    assert kit["workspace_id"] == "default"
    assert kit["accent_color"].startswith("#")
    assert kit["primary_color"].startswith("#")
    assert kit["name"] == "Untitled Brand"


@pytest.mark.asyncio
async def test_brand_kit_update_persists(client):
    await client.get("/api/v1/brand-kit")
    updated = await client.put(
        "/api/v1/brand-kit",
        json={
            "name": "Acme",
            "accent_color": "#FF8800",
            "voice_dos": "Be specific.",
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Acme"
    assert body["accent_color"] == "#FF8800"
    assert body["voice_dos"] == "Be specific."

    refetch = await client.get("/api/v1/brand-kit")
    assert refetch.json()["accent_color"] == "#FF8800"


@pytest.mark.asyncio
async def test_brand_kit_rejects_bad_hex(client):
    response = await client.put(
        "/api/v1/brand-kit", json={"accent_color": "not-a-color"}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_or_create_recovers_from_unique_violation():
    """Two concurrent get_or_create calls under React StrictMode's double-effect
    both see an empty workspace, both INSERT, and the loser hits the
    UNIQUE(workspace_id) constraint. The repo must catch IntegrityError and
    re-read the winner's row instead of bubbling the error to the user."""

    async def _call() -> BrandKit:
        async with AsyncSession(test_engine, expire_on_commit=False) as session:
            return await BrandKitRepository(session).get_or_create("race-test")

    # Fire both in parallel — one will win the INSERT, the other will hit the
    # constraint and fall back to the recovery SELECT.
    first, second = await asyncio.gather(_call(), _call())

    assert first.workspace_id == "race-test"
    assert second.workspace_id == "race-test"
    assert first.id == second.id  # both calls observed the same persisted row
