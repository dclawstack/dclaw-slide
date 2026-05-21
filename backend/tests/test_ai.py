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
async def test_speaker_notes_404_for_missing_slide(client):
    import uuid

    response = await client.post(
        f"/api/v1/ai/speaker-notes/{uuid.uuid4()}",
        json={"save": False},
    )
    assert response.status_code == 404
