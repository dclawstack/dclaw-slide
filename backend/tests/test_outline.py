from app.services.outline import parse_outline


def test_parses_h1_into_separate_slides():
    outline = """# Title
- bullet one
- bullet two

# Second slide
- only one bullet
"""
    slides = parse_outline(outline)
    assert len(slides) == 2
    assert slides[0].title == "Title"
    assert "- bullet one" in slides[0].body
    assert "- bullet two" in slides[0].body
    assert slides[1].title == "Second slide"
    assert slides[0].layout == "title-bullets"


def test_h2_uses_section_header_layout():
    slides = parse_outline("## Act II\nintro line")
    assert len(slides) == 1
    assert slides[0].title == "Act II"
    assert slides[0].layout == "section-header"
    assert "intro line" in slides[0].body


def test_empty_outline_returns_one_placeholder():
    slides = parse_outline("")
    assert len(slides) == 1
    assert slides[0].title == "Untitled deck"


def test_orphan_bullets_get_untitled_slide():
    slides = parse_outline("- floating bullet")
    assert len(slides) == 1
    assert slides[0].title == "Untitled"
    assert "- floating bullet" in slides[0].body
