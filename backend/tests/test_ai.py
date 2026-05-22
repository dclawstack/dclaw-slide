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
async def test_deterministic_slide_bodies_reference_the_prompt_subject():
    """The whole point of this provider being 'usable': non-title slides
    should mention the user's topic, not generic placeholders. Without this,
    a pitch for legal-AI ends up reading the same as a pitch for dog-walking.
    """
    provider = DeterministicProvider()
    slides = await provider.generate_deck(
        prompt="AI tool for legal contract review", target_slides=6, deck_type="pitch"
    )
    # Skip the hero slide (it always echoes the prompt); ensure the rest of
    # the deck weaves the subject into the bullets.
    bodies = [s.body for s in slides[1:]]
    matching = sum(1 for b in bodies if "legal contract review" in b)
    assert matching >= 2, f"only {matching}/{len(bodies)} slides mention the subject"


def test_parse_llm_json_handles_markdown_wrapping():
    from app.services.ai.providers import _parse_llm_json

    # Direct JSON object.
    assert _parse_llm_json('{"slides": []}') == {"slides": []}

    # Wrapped in ```json … ```
    wrapped = '```json\n{"slides": [{"title": "x"}]}\n```'
    parsed = _parse_llm_json(wrapped)
    assert parsed == {"slides": [{"title": "x"}]}

    # Wrapped in ```…``` without language tag.
    assert _parse_llm_json('```\n{"a": 1}\n```') == {"a": 1}

    # Prose preamble + JSON.
    assert _parse_llm_json('Sure, here it is:\n{"a": 1}\nLet me know!') == {"a": 1}

    # Top-level array.
    assert _parse_llm_json('[{"title": "one"}]') == [{"title": "one"}]


def test_coerce_slides_accepts_top_level_array():
    from app.services.ai.providers import _coerce_slides

    raw = [
        {"title": "A", "body": "- one", "layout": "title-bullets"},
        {"title": "B", "body": "- two", "layout": "title-only"},
    ]
    slides = _coerce_slides(raw, target_slides=5)
    assert len(slides) == 2
    assert slides[0].title == "A"


def test_coerce_slides_reflows_single_line_bullets():
    """Small models sometimes emit bullets on one line: '- a - b - c'. We
    re-flow into one-per-line so the layout picker counts them correctly."""
    from app.services.ai.providers import _coerce_slides

    raw = {
        "slides": [
            {
                "title": "x",
                "layout": "title-bullets",
                "body": "- Freelancers forget invoices. - Payments are late. - It costs them time.",
            }
        ]
    }
    slides = _coerce_slides(raw, target_slides=3)
    assert slides[0].body.count("\n") == 2
    lines = slides[0].body.split("\n")
    assert all(l.startswith("- ") for l in lines)
    assert lines[0] == "- Freelancers forget invoices."
    assert lines[1] == "- Payments are late."


def test_coerce_slides_accepts_alternative_keys():
    """Small models sometimes wrap slides under 'deck' or 'presentation'."""
    from app.services.ai.providers import _coerce_slides

    for key in ("slides", "deck", "presentation", "items"):
        raw = {key: [{"title": "X", "body": "- y", "layout": "title-only"}]}
        slides = _coerce_slides(raw, target_slides=3)
        assert len(slides) == 1


@pytest.mark.asyncio
async def test_deterministic_strips_imperative_prefixes_from_subject():
    """User prompts like 'create a 5-slide pitch about X' should yield slides
    talking about X, not 'create a 5-slide pitch about X'."""
    from app.services.ai.providers import _extract_subject
    assert _extract_subject("Create a 5-slide pitch about legal AI") == "legal AI"
    assert _extract_subject("a deck for our Series A on robotics") == "our Series A on robotics"
    assert _extract_subject("8-slide pitch for sales analytics") == "sales analytics"
    # No prefix → returned unchanged.
    assert _extract_subject("Quarterly board review") == "Quarterly board review"


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
