import pytest

from app.models.brand_reference import BrandReference
from app.services.rag import format_for_prompt, rank


def _ref(title: str, body: str) -> BrandReference:
    return BrandReference(title=title, body=body, workspace_id="default")


def test_rank_ignores_stopwords_and_finds_topical_doc():
    refs = [
        _ref("CRM pitch", "We help sales teams close deals faster with AI."),
        _ref("Cooking recipes", "Boil water, add pasta, drain."),
        _ref("Sales playbook", "Outbound sales motion, MEDDPICC, win rates."),
    ]
    hits = rank("AI for sales teams to close more deals", refs)
    assert len(hits) >= 2
    titles = [h.reference.title for h in hits[:2]]
    assert "CRM pitch" in titles or "Sales playbook" in titles
    # Cooking is unrelated → should be lowest or absent.
    if hits[-1].reference.title == "Cooking recipes":
        assert hits[-1].score < hits[0].score


def test_empty_query_returns_no_hits():
    assert rank("", [_ref("x", "y")]) == []


def test_no_references_returns_empty():
    assert rank("anything", []) == []


def test_format_for_prompt_truncates_long_bodies():
    refs = [_ref("Long", "x" * 1000)]
    hits = rank("Long", refs)
    rendered = format_for_prompt(hits)
    # Body got truncated.
    assert "…" in rendered
    # New framing emphasizes style-only.
    assert "STYLE EXAMPLES" in rendered


def test_rank_excludes_weak_topical_matches():
    """A reference about 'sales decks' shouldn't fire for a 'CRM tool' prompt
    just because both mention 'sales' once. Below the threshold, the retriever
    returns nothing — and the LLM stays on the user's topic."""
    refs = [
        _ref(
            "Sales deck playbook",
            "Our sales reps build decks every week. Decks should be clean. "
            "Avoid jargon. Show numbers. Active voice.",
        ),
    ]
    # Single shared word ("sales") shouldn't trigger retrieval.
    hits = rank("a CRM tool for small business teams", refs)
    assert len(hits) == 0


def test_rank_keeps_strong_topical_matches():
    """Conversely, a real topical match (multiple shared content words) should
    still come through after thresholding."""
    refs = [
        _ref(
            "Sales deck playbook",
            "Our sales reps build decks every week. Decks should be clean.",
        ),
    ]
    # Many shared content words → score well above the threshold.
    hits = rank("how to build clean sales decks for reps every week", refs)
    assert len(hits) == 1


@pytest.mark.asyncio
async def test_brand_reference_crud(client):
    create = await client.post(
        "/api/v1/brand-references",
        json={"title": "Q3 board deck", "body": "We focused on margin expansion and ARR mix."},
    )
    assert create.status_code == 201
    rid = create.json()["id"]

    listed = (await client.get("/api/v1/brand-references")).json()
    assert len(listed) == 1
    assert listed[0]["body_chars"] > 0
    assert listed[0]["title"] == "Q3 board deck"

    deleted = await client.delete(f"/api/v1/brand-references/{rid}")
    assert deleted.status_code == 204
    assert (await client.get("/api/v1/brand-references")).json() == []


@pytest.mark.asyncio
async def test_generate_deck_reports_references_used(client):
    # Seed two relevant + one irrelevant reference.
    for title, body in [
        ("Deal sourcing wins", "Pipeline coverage, ICP fit, outbound velocity."),
        ("Top of funnel", "Cold outreach, intent data, ICP scoring."),
        ("Office snacks SOP", "Restock the pantry every Friday."),
    ]:
        await client.post("/api/v1/brand-references", json={"title": title, "body": body})

    response = await client.post(
        "/api/v1/ai/generate-deck",
        json={
            "prompt": "AI assistant for outbound sales pipeline coverage",
            "target_slides": 4,
            "use_brand_references": True,
        },
    )
    assert response.status_code == 201
    body = response.json()
    # We seeded relevant refs — RAG should have picked at least one.
    assert body["references_used"] >= 1


@pytest.mark.asyncio
async def test_generate_deck_without_references_reports_zero(client):
    response = await client.post(
        "/api/v1/ai/generate-deck",
        json={"prompt": "Empty workspace", "target_slides": 3, "use_brand_references": True},
    )
    assert response.status_code == 201
    assert response.json()["references_used"] == 0
