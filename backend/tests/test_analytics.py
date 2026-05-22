import pytest


async def _deck_with_slides(client) -> tuple[str, list[dict]]:
    created = await client.post("/api/v1/presentations", json={"title": "Analytics"})
    pid = created.json()["id"]
    await client.post(
        f"/api/v1/presentations/{pid}/outline",
        json={"outline": "# A\n# B\n# C"},
    )
    slides = (await client.get(f"/api/v1/presentations/{pid}/slides")).json()
    return pid, slides


@pytest.mark.asyncio
async def test_event_recorded_and_summary_aggregates(client):
    pid, slides = await _deck_with_slides(client)
    session = "sess-1"

    for slide in slides:
        for _ in range(2):
            r = await client.post(
                f"/api/v1/presentations/{pid}/analytics/event",
                json={
                    "slide_id": slide["id"],
                    "session_id": session,
                    "event_type": "slide_view",
                },
            )
            assert r.status_code == 201
        await client.post(
            f"/api/v1/presentations/{pid}/analytics/event",
            json={
                "slide_id": slide["id"],
                "session_id": session,
                "event_type": "dwell",
                "dwell_ms": 4000,
            },
        )

    await client.post(
        f"/api/v1/presentations/{pid}/analytics/event",
        json={"session_id": session, "event_type": "finish"},
    )

    summary = (await client.get(f"/api/v1/presentations/{pid}/analytics/summary")).json()
    assert summary["total_sessions"] == 1
    assert summary["completion_rate"] == 1.0
    by_position = {s["position"]: s for s in summary["slides"]}
    assert by_position[0]["views"] == 2
    assert by_position[1]["total_dwell_ms"] == 4000
    assert by_position[2]["average_dwell_ms"] == 4000


@pytest.mark.asyncio
async def test_unknown_event_type_rejected(client):
    pid, _ = await _deck_with_slides(client)
    response = await client.post(
        f"/api/v1/presentations/{pid}/analytics/event",
        json={"session_id": "s", "event_type": "wat"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_event_accepts_text_plain_body_from_beacon(client):
    """navigator.sendBeacon cross-origin can only send text/plain. The endpoint
    must accept the JSON payload regardless of Content-Type."""
    pid, slides = await _deck_with_slides(client)
    response = await client.post(
        f"/api/v1/presentations/{pid}/analytics/event",
        content=(
            '{"session_id":"beacon-1","event_type":"dropoff",'
            f'"slide_id":"{slides[0]["id"]}"' + "}"
        ),
        headers={"Content-Type": "text/plain"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["event_type"] == "dropoff"
    assert body["session_id"] == "beacon-1"


@pytest.mark.asyncio
async def test_event_rejects_empty_body(client):
    pid, _ = await _deck_with_slides(client)
    response = await client.post(
        f"/api/v1/presentations/{pid}/analytics/event",
        content="",
        headers={"Content-Type": "text/plain"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_dropoff_counted(client):
    pid, slides = await _deck_with_slides(client)
    await client.post(
        f"/api/v1/presentations/{pid}/analytics/event",
        json={
            "slide_id": slides[1]["id"],
            "session_id": "s2",
            "event_type": "dropoff",
        },
    )
    summary = (await client.get(f"/api/v1/presentations/{pid}/analytics/summary")).json()
    by_position = {s["position"]: s for s in summary["slides"]}
    assert by_position[1]["dropoffs"] == 1
    assert summary["completion_rate"] == 0.0
