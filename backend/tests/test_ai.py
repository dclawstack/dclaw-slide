import json

import pytest

from app.services.ai.providers import DeterministicProvider


@pytest.mark.asyncio
async def test_deterministic_generate_deck_pitch_template():
    provider = DeterministicProvider()
    slides = await provider.generate_deck(
        prompt="AI presentation tool for founders", target_slides=5, deck_type="pitch"
    )
    assert len(slides) == 5
    assert slides[0].title.startswith("AI presentation tool")
    assert slides[0].layout == "title-only"
    titles = [s.title for s in slides]
    assert "Problem" in titles
    assert "Solution" in titles


@pytest.mark.asyncio
async def test_deterministic_does_not_leak_todo_placeholders():
    """When target_slides exceeds the template length, the extra slides should
    be prompt-derived deep dives — never a literal 'TODO' placeholder."""
    provider = DeterministicProvider()
    slides = await provider.generate_deck(
        prompt="Q3 board update on margin expansion",
        target_slides=12,
        deck_type="report",  # report template has 7 sections, so 5 extras
    )
    assert len(slides) == 12
    for s in slides:
        assert "TODO" not in s.body, f"slide {s.title!r} leaked TODO: {s.body!r}"
    assert any(s.title.startswith("Deep dive") for s in slides[7:])


@pytest.mark.asyncio
async def test_deterministic_generate_speaker_notes_returns_questions():
    provider = DeterministicProvider()
    notes = await provider.generate_speaker_notes(
        slide_title="Problem",
        slide_body="- High deck-build time\n- Brand drift",
        deck_context="pitch deck",
    )
    assert notes.notes
    assert len(notes.likely_questions) >= 3
    assert any("Problem" in q for q in notes.likely_questions)


@pytest.mark.asyncio
async def test_generate_deck_endpoint_creates_presentation(client):
    response = await client.post(
        "/api/v1/ai/generate-deck",
        json={
            "prompt": "Brand-locked decks for sales teams",
            "target_slides": 6,
            "deck_type": "pitch",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["provider"] == "deterministic"
    deck = body["presentation"]
    assert deck["title"]
    assert len(deck["slides"]) == 6
    positions = [s["position"] for s in deck["slides"]]
    assert positions == sorted(positions)


@pytest.mark.asyncio
async def test_generate_deck_endpoint_updates_existing(client):
    created = await client.post("/api/v1/presentations", json={"title": "Existing"})
    pid = created.json()["id"]
    response = await client.post(
        "/api/v1/ai/generate-deck",
        json={
            "prompt": "Replace this deck",
            "target_slides": 3,
            "presentation_id": pid,
            "replace_existing": True,
        },
    )
    assert response.status_code == 201
    deck = response.json()["presentation"]
    assert deck["id"] == pid
    assert len(deck["slides"]) == 3


@pytest.mark.asyncio
async def test_speaker_notes_endpoint_saves(client):
    deck_resp = await client.post(
        "/api/v1/ai/generate-deck",
        json={"prompt": "Test", "target_slides": 2},
    )
    slide = deck_resp.json()["presentation"]["slides"][1]
    notes_resp = await client.post(
        f"/api/v1/ai/speaker-notes/{slide['id']}",
        json={"save": True},
    )
    assert notes_resp.status_code == 200
    body = notes_resp.json()
    assert body["notes"]
    assert len(body["likely_questions"]) >= 3
    assert body["slide"]["speaker_notes"] == body["notes"]


@pytest.mark.asyncio
async def test_stream_generate_deck_emits_ready_slide_done(client, monkeypatch):
    """The SSE endpoint should emit:
      - one `ready` event with provider + presentation_id
      - one `slide` event per generated slide (persisted to the DB as it goes)
      - one final `done` event with the total slide count
    """
    # Suppress the artificial demo delay so the test runs instantly.
    from app.services.ai.providers import DeterministicProvider
    monkeypatch.setattr(DeterministicProvider, "stream_delay_ms", 0)

    async with client.stream(
        "POST",
        "/api/v1/ai/generate-deck-stream",
        json={"prompt": "stream me", "target_slides": 3, "deck_type": "pitch"},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        events: list[tuple[str, dict]] = []
        current_event: str | None = None
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and current_event:
                events.append((current_event, json.loads(line.split(":", 1)[1].strip())))
                current_event = None

    types = [e[0] for e in events]
    assert types[0] == "ready"
    assert types[-1] == "done"
    slide_events = [d for t, d in events if t == "slide"]
    assert len(slide_events) == 3
    assert slide_events[0]["position"] == 0
    assert slide_events[-1]["position"] == 2

    # Slides should be queryable mid-stream (in our case, fully present at end).
    pid = events[0][1]["presentation_id"]
    deck = (await client.get(f"/api/v1/presentations/{pid}")).json()
    assert len(deck["slides"]) == 3


@pytest.mark.asyncio
async def test_speaker_notes_404_for_missing_slide(client):
    import uuid

    response = await client.post(
        f"/api/v1/ai/speaker-notes/{uuid.uuid4()}",
        json={"save": False},
    )
    assert response.status_code == 404
