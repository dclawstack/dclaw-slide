import pytest


@pytest.mark.asyncio
async def test_themes_list(client):
    response = await client.get("/api/v1/themes")
    assert response.status_code == 200
    themes = response.json()
    assert len(themes) >= 3
    ids = {t["id"] for t in themes}
    assert "pitch-classic" in ids


@pytest.mark.asyncio
async def test_theme_lookup_404(client):
    response = await client.get("/api/v1/themes/does-not-exist")
    assert response.status_code == 404
