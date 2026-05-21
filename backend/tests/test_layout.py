from app.services.layout import pick_layout


def test_empty_body_is_title_only():
    assert pick_layout("Hook", "", None) == "title-only"


def test_single_short_bullet_is_title_only():
    assert pick_layout("Hook", "- Why now", None) == "title-only"


def test_two_short_bullets_is_two_column():
    assert pick_layout("Tradeoffs", "- Fast and cheap\n- Reliable enough", None) == "two-column"


def test_many_bullets_is_title_bullets():
    body = "- one\n- two\n- three\n- four"
    assert pick_layout("List", body, None) == "title-bullets"


def test_quote_detected():
    assert pick_layout("Voice of customer", '"This saved us hours."', None) == "quote"


def test_section_header_keyword():
    assert pick_layout("Q&A", "", None) == "section-header"
    assert pick_layout("Section 2", "", None) == "section-header"


def test_existing_section_header_preserved():
    # User intent (already labeled as section-header) wins over heuristics.
    assert pick_layout("Anything", "- a\n- b", "section-header") == "section-header"


def test_long_bullet_falls_back_to_bullets():
    body = "- " + ("x" * 220)
    assert pick_layout("Long", body, None) == "title-bullets"
