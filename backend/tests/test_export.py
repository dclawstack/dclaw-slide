import io
import zipfile

import pytest


async def _seed_deck(client) -> str:
    created = await client.post("/api/v1/presentations", json={"title": "Export Demo"})
    pid = created.json()["id"]
    await client.post(
        f"/api/v1/presentations/{pid}/outline",
        json={"outline": "# Hook\n- Why now\n# Solution\n- Demo\n- Numbers"},
    )
    return pid


@pytest.mark.asyncio
async def test_export_html_returns_zip(client):
    pid = await _seed_deck(client)
    response = await client.get(f"/api/v1/presentations/{pid}/export?format=html")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "Export_Demo.zip" in response.headers["content-disposition"]
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert "index.html" in archive.namelist()
    html = archive.read("index.html").decode()
    assert "Hook" in html and "Solution" in html


@pytest.mark.asyncio
async def test_export_pptx_returns_office_blob(client):
    pid = await _seed_deck(client)
    response = await client.get(f"/api/v1/presentations/{pid}/export?format=pptx")
    assert response.status_code == 200
    assert response.headers["content-type"].endswith("presentationml.presentation")
    # PPTX is a zip container; the first 4 bytes are PK..
    assert response.content[:2] == b"PK"
    assert len(response.content) > 5000


@pytest.mark.asyncio
async def test_export_pdf_returns_pdf_blob(client):
    pid = await _seed_deck(client)
    response = await client.get(f"/api/v1/presentations/{pid}/export?format=pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:4] == b"%PDF"


@pytest.mark.asyncio
async def test_export_unknown_format_is_422(client):
    pid = await _seed_deck(client)
    response = await client.get(f"/api/v1/presentations/{pid}/export?format=keynote")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_auto_layout_promotes_short_bullet_to_title_only(client):
    pid = await _seed_deck(client)
    deck = (await client.get(f"/api/v1/presentations/{pid}")).json()
    assert deck["slides"][0]["layout"] in {"title-only", "title-bullets"}

    relayout = await client.post(f"/api/v1/presentations/{pid}/auto-layout")
    assert relayout.status_code == 200
    layouts = [s["layout"] for s in relayout.json()["slides"]]
    # "# Hook\n- Why now" → single short bullet → title-only.
    assert layouts[0] == "title-only"
