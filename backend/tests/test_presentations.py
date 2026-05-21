import pytest


@pytest.mark.asyncio
async def test_create_and_list_presentations(client):
    create = await client.post(
        "/api/v1/presentations",
        json={"title": "Series A Pitch"},
    )
    assert create.status_code == 201
    created = create.json()
    assert created["title"] == "Series A Pitch"
    assert created["status"] == "draft"
    assert created["slides"] == []

    listed = await client.get("/api/v1/presentations")
    assert listed.status_code == 200
    summaries = listed.json()
    assert len(summaries) == 1
    assert summaries[0]["slide_count"] == 0


@pytest.mark.asyncio
async def test_unknown_theme_rejected(client):
    response = await client.post(
        "/api/v1/presentations",
        json={"title": "x", "theme_id": "not-a-theme"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_outline_creates_ordered_slides(client):
    create = await client.post("/api/v1/presentations", json={"title": "Outline test"})
    pid = create.json()["id"]

    outline = "# Intro\n- hook\n# Problem\n- pain\n- bigger pain\n# Solution\n- demo"
    apply = await client.post(
        f"/api/v1/presentations/{pid}/outline",
        json={"outline": outline},
    )
    assert apply.status_code == 200
    deck = apply.json()
    assert [s["title"] for s in deck["slides"]] == ["Intro", "Problem", "Solution"]
    assert deck["slides"][1]["position"] == 1
    assert "- pain" in deck["slides"][1]["body"]


@pytest.mark.asyncio
async def test_reorder_slides(client):
    create = await client.post("/api/v1/presentations", json={"title": "Reorder"})
    pid = create.json()["id"]
    await client.post(
        f"/api/v1/presentations/{pid}/outline",
        json={"outline": "# A\n# B\n# C"},
    )
    deck = (await client.get(f"/api/v1/presentations/{pid}")).json()
    ids = [s["id"] for s in deck["slides"]]
    reversed_ids = list(reversed(ids))

    reorder = await client.post(
        f"/api/v1/presentations/{pid}/slides/reorder",
        json={"slide_ids": reversed_ids},
    )
    assert reorder.status_code == 200
    new_order = [s["id"] for s in reorder.json()]
    assert new_order == reversed_ids
    assert [s["position"] for s in reorder.json()] == [0, 1, 2]


@pytest.mark.asyncio
async def test_update_and_delete_slide(client):
    create = await client.post("/api/v1/presentations", json={"title": "Edit"})
    pid = create.json()["id"]
    await client.post(
        f"/api/v1/presentations/{pid}/outline",
        json={"outline": "# Keep\n# Drop"},
    )
    slides = (await client.get(f"/api/v1/presentations/{pid}/slides")).json()
    target = slides[1]

    patch = await client.patch(
        f"/api/v1/presentations/{pid}/slides/{target['id']}",
        json={"title": "Renamed", "speaker_notes": "say this"},
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "Renamed"
    assert patch.json()["speaker_notes"] == "say this"

    delete = await client.delete(
        f"/api/v1/presentations/{pid}/slides/{target['id']}"
    )
    assert delete.status_code == 204

    remaining = (await client.get(f"/api/v1/presentations/{pid}/slides")).json()
    assert len(remaining) == 1


@pytest.mark.asyncio
async def test_delete_presentation_cascades(client):
    create = await client.post("/api/v1/presentations", json={"title": "Cascade"})
    pid = create.json()["id"]
    await client.post(
        f"/api/v1/presentations/{pid}/outline",
        json={"outline": "# A\n# B"},
    )
    delete = await client.delete(f"/api/v1/presentations/{pid}")
    assert delete.status_code == 204
    missing = await client.get(f"/api/v1/presentations/{pid}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_health_reports_version_and_db(client):
    response = await client.get("/health/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert body["db"] in {"sqlite", "postgres"}
