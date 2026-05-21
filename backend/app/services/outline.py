from dataclasses import dataclass


@dataclass
class ParsedSlide:
    title: str
    body: str
    layout: str


def parse_outline(outline: str) -> list[ParsedSlide]:
    """Parse a markdown-ish outline into ordered slide drafts.

    Rules:
      - Lines starting with "# " open a new slide (title-bullets layout).
      - Lines starting with "## " open a new slide using the section-header layout.
      - Bullets ("- " / "* ") become body lines of the current slide.
      - Plain text under a heading becomes body lines too.
      - A blank outline returns one empty slide so the editor never crashes.
    """
    slides: list[ParsedSlide] = []
    current: ParsedSlide | None = None
    body_lines: list[str] = []

    def flush() -> None:
        nonlocal current, body_lines
        if current is not None:
            current.body = "\n".join(line for line in body_lines if line.strip())
            slides.append(current)
        body_lines = []

    for raw_line in outline.splitlines():
        line = raw_line.rstrip()
        stripped = line.lstrip()
        if stripped.startswith("# "):
            flush()
            current = ParsedSlide(title=stripped[2:].strip(), body="", layout="title-bullets")
        elif stripped.startswith("## "):
            flush()
            current = ParsedSlide(title=stripped[3:].strip(), body="", layout="section-header")
        elif stripped.startswith(("- ", "* ")):
            if current is None:
                current = ParsedSlide(title="Untitled", body="", layout="title-bullets")
            body_lines.append(f"- {stripped[2:].strip()}")
        elif stripped:
            if current is None:
                current = ParsedSlide(title=stripped[:80], body="", layout="title-only")
            else:
                body_lines.append(stripped)
    flush()

    if not slides:
        slides.append(ParsedSlide(title="Untitled deck", body="", layout="title-only"))

    return slides
