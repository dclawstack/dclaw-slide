import pytest


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
