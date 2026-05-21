"""Heuristic layout picker for slides.

Five layouts are supported:
  - title-only        — hero slide with no bullets
  - title-bullets     — default, vertical bullet list
  - section-header    — divider slide between deck sections
  - quote             — a single quoted line (italic, centered)
  - two-column        — exactly 2 short bullets, split left/right

The picker is deterministic and fast. It runs at three times:
  1. After AI deck generation, to override poor LLM choices.
  2. On the dedicated /auto-layout endpoint, to relayout a deck on demand.
  3. (Future) Inside the design critic in C2.1's multi-agent pipeline.
"""

from __future__ import annotations

import re

ALLOWED = {"title-only", "title-bullets", "section-header", "quote", "two-column"}

_SECTION_KEYWORDS = re.compile(
    r"\b(section|act|chapter|part|q\s*&\s*a|q&a|questions|appendix|intermission|break|interlude)\b",
    re.IGNORECASE,
)


def _bullets(body: str) -> list[str]:
    return [
        line[2:].strip()
        for line in body.splitlines()
        if line.startswith(("- ", "* "))
    ]


def _looks_like_quote(body: str) -> bool:
    stripped = body.strip()
    if not stripped:
        return False
    head = stripped[:1]
    tail = stripped[-1:]
    return head in {'"', "“", "‘", "'"} and tail in {'"', "”", "’", "'"}


def pick_layout(title: str, body: str, current_layout: str | None = None) -> str:
    """Return the best layout for a slide.

    Honors `current_layout` only when it's a section-header (deck divider) or a
    quote already authored by the user — those are intent signals we don't override.
    """
    if current_layout == "section-header":
        return "section-header"

    if _looks_like_quote(body):
        return "quote"

    bullets = _bullets(body)

    if _SECTION_KEYWORDS.search(title) and not bullets:
        return "section-header"

    if not bullets and not body.strip():
        return "title-only"

    if len(bullets) == 1 and len(bullets[0]) <= 80:
        return "title-only"

    if len(bullets) == 2 and sum(len(b) for b in bullets) <= 200:
        return "two-column"

    return "title-bullets"


def relayout_pairs(
    slides: list[tuple[str, str, str | None]]
) -> list[str]:
    """Apply pick_layout to a batch. Input is (title, body, current_layout)."""
    return [pick_layout(title, body, current) for title, body, current in slides]
