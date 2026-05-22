"""LLM provider abstraction for DClaw Slide.

Three implementations:
  - DeterministicProvider: template-based, no network, always works (tests + offline dev).
  - OllamaProvider: POST to /api/chat on a local Ollama server.
  - OpenRouterProvider: POST to OpenRouter's OpenAI-compatible chat API.

Selection is `auto` by default: try Ollama → OpenRouter → Deterministic.
Override with `AI_PROVIDER=ollama|openrouter|deterministic`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GeneratedSlide:
    title: str
    layout: str
    body: str


@dataclass
class SpeakerNotes:
    notes: str
    likely_questions: list[str]


SYSTEM_DECK_PROMPT = (
    "You are DClaw Slide's deck-generation agent. "
    "Return strict JSON of the form "
    '{"slides": [{"title": str, "layout": str, "body": str}, ...]}. '
    "Allowed layouts: title-only, title-bullets, section-header, quote, two-column. "
    "Body should be markdown bullets, each on its own line, prefixed with '- '. "
    "Slides should be sharp, concrete, founder-grade. Do not include any prose outside the JSON."
)

SYSTEM_NOTES_PROMPT = (
    "You are a presentation coach. For the given slide, return strict JSON "
    '{"notes": str, "likely_questions": [str, ...]}. '
    "Notes are 2-4 sentences a presenter would actually say. "
    "List 3-5 questions an audience is likely to ask after this slide. "
    "Do not include any prose outside the JSON."
)


class LLMProvider(ABC):
    name: str

    @abstractmethod
    async def generate_deck(
        self, prompt: str, target_slides: int, deck_type: str
    ) -> list[GeneratedSlide]: ...

    @abstractmethod
    async def generate_speaker_notes(
        self, slide_title: str, slide_body: str, deck_context: str
    ) -> SpeakerNotes: ...

    async def stream_generate_deck(
        self, prompt: str, target_slides: int, deck_type: str
    ) -> AsyncIterator[GeneratedSlide]:
        """Default: run the batch generator then yield slides one at a time.

        Subclasses with a real streaming API (Ollama, OpenRouter) should
        override this. The base implementation keeps the SSE endpoint working
        for any provider — at minimum the client gets to see slides appear
        progressively instead of all-at-once at the end.
        """
        slides = await self.generate_deck(prompt, target_slides, deck_type)
        for slide in slides:
            yield slide


# ──────────────────────────────────────────────────────────────────────────────
# Deterministic — always works, used in tests and as the safety net.
# ──────────────────────────────────────────────────────────────────────────────


def _extract_subject(prompt: str) -> str:
    """Strip imperative verbs and slide-count prefaces so the rest of the
    template can refer to the topic naturally. Pure best-effort heuristic —
    real semantics come from Ollama/OpenRouter."""
    text = prompt.strip()
    # Strip common deck-size prefaces like "5-slide pitch about X" or
    # "create a deck for X".
    patterns = [
        r"^(?:please\s+)?(?:can\s+you\s+)?(?:create|generate|make|build|write|prepare|design|put\s+together)\s+(?:a\s+|an\s+)?(?:deck|pitch|presentation|report|slides?)?\s*(?:about\s+|on\s+|for\s+)?",
        r"^\d+[\s-]*slides?\s+(?:pitch|deck|presentation|report)?\s*(?:about\s+|on\s+|for\s+)?",
        r"^(?:a\s+|an\s+)?(?:pitch|deck|presentation|report)\s+(?:about\s+|on\s+|for\s+)",
    ]
    for pat in patterns:
        text = re.sub(pat, "", text, flags=re.IGNORECASE).strip()
    return text or prompt.strip() or "your idea"


def _short(text: str, n: int) -> str:
    """Compact a subject phrase for inline use; preserves whole words."""
    text = text.strip()
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(" ", 1)[0]
    return cut + "…"


def _pitch_sections(subject: str) -> list[tuple[str, str, str]]:
    s = _short(subject, 70)
    return [
        ("Hook", "title-only",
         f"- {s}\n- Why now, in one line"),
        ("Problem", "title-bullets",
         f"- The pain {s} addresses today\n- Why current tools fall short\n- The cost of doing nothing"),
        ("Solution", "title-bullets",
         f"- How {s} works\n- The wedge versus incumbents\n- Demo screenshot here"),
        ("Why now", "title-bullets",
         f"- Market tailwind driving {s}\n- Technology unlock that makes it possible now\n- Window-closing argument"),
        ("Market", "title-bullets",
         f"- TAM / SAM / SOM for {s}\n- Beachhead segment we win first\n- Expansion path from there"),
        ("Traction", "title-bullets",
         f"- Pilots / LOIs for {s}\n- Revenue or engagement to date\n- Pipeline coverage"),
        ("Business model", "title-bullets",
         f"- Pricing for {s}\n- Unit economics at scale\n- Path to profitability"),
        ("Why us", "title-bullets",
         f"- Founding insight on {s}\n- Unfair advantage we bring\n- Why this team wins"),
        ("Roadmap", "title-bullets",
         f"- Next 90 days for {s}\n- Next 12 months\n- Three-year vision"),
        ("Ask", "title-bullets",
         f"- The round we're raising\n- Use of funds for {s}\n- Milestones to next raise"),
    ]


def _report_sections(subject: str) -> list[tuple[str, str, str]]:
    s = _short(subject, 70)
    return [
        ("Executive summary", "title-only",
         f"- Headline finding about {s}\n- One-line outcome"),
        ("Methodology", "title-bullets",
         f"- Data sources used for {s}\n- Time window covered\n- Sample size and caveats"),
        ("Findings", "title-bullets",
         f"- Top finding on {s}\n- Second finding\n- Third finding"),
        ("Deep dive", "two-column",
         f"- Quantitative signal on {s}\n- Qualitative interpretation"),
        ("Risks", "title-bullets",
         f"- Largest risk to {s}\n- Mitigation strategy\n- Watchlist items"),
        ("Recommendations", "title-bullets",
         f"- First action on {s}\n- Owner + due date\n- Success metric"),
        ("Appendix", "section-header", ""),
    ]


def _training_sections(subject: str) -> list[tuple[str, str, str]]:
    s = _short(subject, 70)
    return [
        ("Welcome", "title-only",
         f"- What you'll learn about {s}\n- Time investment"),
        ("Why this matters", "title-bullets",
         f"- Outcome you'll have after this session\n- How {s} unlocks it\n- Who this is for"),
        ("Core concept", "title-bullets",
         f"- Definition of the key idea in {s}\n- Worked example\n- Common misconception"),
        ("Walkthrough", "two-column",
         f"- Step-by-step using {s}\n- Screenshot or live demo"),
        ("Practice", "title-bullets",
         f"- Exercise to try with {s}\n- Checkpoint question\n- Where to get help"),
        ("Q&A", "section-header", ""),
    ]


def _section_template(deck_type: str, subject: str) -> list[tuple[str, str, str]]:
    if deck_type == "report":
        return _report_sections(subject)
    if deck_type == "training":
        return _training_sections(subject)
    return _pitch_sections(subject)


class DeterministicProvider(LLMProvider):
    name = "deterministic"

    # Used to simulate token-by-token generation in dev when no real LLM is
    # configured. The SSE demo flow is the main consumer; tests can pass 0.
    stream_delay_ms: int = 220

    async def stream_generate_deck(
        self, prompt: str, target_slides: int, deck_type: str
    ) -> AsyncIterator[GeneratedSlide]:
        slides = await self.generate_deck(prompt, target_slides, deck_type)
        for slide in slides:
            if self.stream_delay_ms > 0:
                await asyncio.sleep(self.stream_delay_ms / 1000)
            yield slide

    async def generate_deck(
        self, prompt: str, target_slides: int, deck_type: str
    ) -> list[GeneratedSlide]:
        subject = _extract_subject(prompt)
        template = _section_template(deck_type, subject)
        target = max(1, min(target_slides, 16))
        sections: list[tuple[str, str, str]] = list(template[:target])
        # Prompt-aware "deep dive" slides if user wants more than the template has.
        extras = max(0, target - len(template))
        deep_dive_angles = [
            "Operational angle",
            "Financial angle",
            "Competitive angle",
            "Customer angle",
            "Risk angle",
            "Differentiation angle",
        ]
        for n in range(extras):
            angle = deep_dive_angles[n % len(deep_dive_angles)]
            s = _short(subject, 70)
            sections.append(
                (
                    f"Deep dive — {angle.split(' ')[0]}",
                    "title-bullets",
                    f"- {angle} on {s}\n- Supporting evidence\n- Open question to answer",
                )
            )
        out: list[GeneratedSlide] = []
        title_slide = _short(subject, 72) or "Untitled deck"
        for idx, (title, layout, body) in enumerate(sections):
            if idx == 0:
                # Hero slide: title is the user's subject; body is a single
                # subtitle line so the layout picker keeps it as title-only
                # (two short bullets would get re-classified to two-column).
                title = title_slide
                body = f"- {_short(subject, 100)}"
                layout = "title-only"
            out.append(GeneratedSlide(title=title, layout=layout, body=body))
        return out

    async def generate_speaker_notes(
        self, slide_title: str, slide_body: str, deck_context: str
    ) -> SpeakerNotes:
        bullets = [
            line[2:].strip()
            for line in slide_body.splitlines()
            if line.startswith(("- ", "* "))
        ]
        first_bullet = bullets[0] if bullets else slide_title
        notes = (
            f"Open by anchoring the audience on \"{slide_title}\". "
            f"Spend ~30s on \"{first_bullet}\" before moving to specifics. "
            "Pause for one question before advancing."
        )
        likely = [
            f"Can you back \"{slide_title}\" up with a number?",
            "How does this compare to the status quo today?",
            "What did you almost build instead, and why didn't you?",
        ]
        if bullets:
            likely.append(f"Tell me more about \"{bullets[0]}\".")
        if len(bullets) > 1:
            likely.append(f"What's the evidence behind \"{bullets[1]}\"?")
        return SpeakerNotes(notes=notes, likely_questions=likely[:5])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers shared by Ollama + OpenRouter
# ──────────────────────────────────────────────────────────────────────────────


def _parse_llm_json(content: str) -> dict | list:
    """Tolerant JSON extractor for LLM responses.

    Small models often wrap JSON in markdown code blocks, add a prose
    preamble ("Sure! Here's the deck:"), or emit a top-level array. This
    pulls the first JSON object/array we can find rather than failing
    strictly on extra prose.
    """
    content = content.strip()
    # Strip markdown code fences.
    if content.startswith("```"):
        # Drop the first line (```json or ```), then trim the trailing fence.
        content = content.split("\n", 1)[-1] if "\n" in content else content[3:]
        if content.rstrip().endswith("```"):
            content = content.rstrip()[:-3]
        content = content.strip()
    # Try direct parse first — fast path when the model behaved.
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    # Find the first balanced { or [ and try sub-strings until one parses.
    for start_idx, opening in enumerate(content):
        if opening not in "{[":
            continue
        closing = "}" if opening == "{" else "]"
        depth = 0
        for end_idx in range(start_idx, len(content)):
            ch = content[end_idx]
            if ch == opening:
                depth += 1
            elif ch == closing:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(content[start_idx : end_idx + 1])
                    except json.JSONDecodeError:
                        break
        if depth == 0:
            break
    raise ValueError(f"could not extract JSON from LLM response: {content[:200]!r}")


def _coerce_slides(raw: object, target_slides: int) -> list[GeneratedSlide]:
    """Accept either {"slides": [...]} or a top-level array; small models
    sometimes skip the wrapping object."""
    if isinstance(raw, list):
        slides_raw = raw
    elif isinstance(raw, dict):
        # Try common keys: slides, deck, presentation, items.
        slides_raw = (
            raw.get("slides")
            or raw.get("deck")
            or raw.get("presentation")
            or raw.get("items")
            or []
        )
        # If the object IS a single slide, wrap it.
        if not slides_raw and {"title", "body"}.issubset(raw.keys()):
            slides_raw = [raw]
    else:
        slides_raw = []
    if not isinstance(slides_raw, list) or not slides_raw:
        raise ValueError("LLM returned no slides")
    out: list[GeneratedSlide] = []
    for item in slides_raw[:target_slides]:
        if not isinstance(item, dict):
            continue
        out.append(
            GeneratedSlide(
                title=str(item.get("title", "")).strip()[:255] or "Untitled",
                layout=str(item.get("layout", "title-bullets")).strip() or "title-bullets",
                body=str(item.get("body", "")).strip(),
            )
        )
    if not out:
        raise ValueError("LLM returned no usable slides")
    return out


def _coerce_notes(raw: dict) -> SpeakerNotes:
    if not isinstance(raw, dict):
        raise ValueError("LLM returned non-object for speaker notes")
    notes = str(raw.get("notes", "")).strip()
    questions_raw = raw.get("likely_questions", [])
    questions = [str(q).strip() for q in questions_raw if str(q).strip()][:5]
    if not notes:
        raise ValueError("LLM returned empty notes")
    return SpeakerNotes(notes=notes, likely_questions=questions)


# ──────────────────────────────────────────────────────────────────────────────
# Ollama
# ──────────────────────────────────────────────────────────────────────────────


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, base_url: str, model: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def _chat(self, system: str, user: str) -> object:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "format": "json",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
        content = payload.get("message", {}).get("content", "")
        return _parse_llm_json(content)

    async def generate_deck(
        self, prompt: str, target_slides: int, deck_type: str
    ) -> list[GeneratedSlide]:
        user = (
            f"Deck type: {deck_type}. Target slide count: {target_slides}. "
            f"User request: {prompt}"
        )
        raw = await self._chat(SYSTEM_DECK_PROMPT, user)
        return _coerce_slides(raw, target_slides)

    async def generate_speaker_notes(
        self, slide_title: str, slide_body: str, deck_context: str
    ) -> SpeakerNotes:
        user = (
            f"Deck context: {deck_context}\n"
            f"Slide title: {slide_title}\n"
            f"Slide body:\n{slide_body}"
        )
        raw = await self._chat(SYSTEM_NOTES_PROMPT, user)
        return _coerce_notes(raw)


# ──────────────────────────────────────────────────────────────────────────────
# OpenRouter (OpenAI-compatible)
# ──────────────────────────────────────────────────────────────────────────────


class OpenRouterProvider(LLMProvider):
    name = "openrouter"
    endpoint = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, api_key: str, model: str, timeout: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def _chat(self, system: str, user: str) -> object:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self.endpoint,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "HTTP-Referer": "https://github.com/dclawstack/dclaw-slide",
                    "X-Title": "DClaw Slide",
                },
                json={
                    "model": self.model,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        return _parse_llm_json(content)

    async def generate_deck(
        self, prompt: str, target_slides: int, deck_type: str
    ) -> list[GeneratedSlide]:
        user = (
            f"Deck type: {deck_type}. Target slide count: {target_slides}. "
            f"User request: {prompt}"
        )
        raw = await self._chat(SYSTEM_DECK_PROMPT, user)
        return _coerce_slides(raw, target_slides)

    async def generate_speaker_notes(
        self, slide_title: str, slide_body: str, deck_context: str
    ) -> SpeakerNotes:
        user = (
            f"Deck context: {deck_context}\n"
            f"Slide title: {slide_title}\n"
            f"Slide body:\n{slide_body}"
        )
        raw = await self._chat(SYSTEM_NOTES_PROMPT, user)
        return _coerce_notes(raw)


# ──────────────────────────────────────────────────────────────────────────────
# Selection
# ──────────────────────────────────────────────────────────────────────────────


async def _ollama_reachable(url: str, timeout: float = 1.0) -> bool:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{url.rstrip('/')}/api/tags")
        return response.status_code == 200
    except Exception:
        return False


async def select_provider() -> LLMProvider:
    """Pick a provider per settings.ai_provider with a 'never throw' fallback.

    `auto` order: Ollama (if reachable) → OpenRouter (if key set) → Deterministic.
    """
    chosen = settings.ai_provider.lower()

    if chosen == "deterministic":
        return DeterministicProvider()

    if chosen == "ollama":
        return OllamaProvider(
            settings.ollama_url, settings.ollama_model, settings.ai_request_timeout
        )

    if chosen == "openrouter":
        if not settings.openrouter_api_key:
            logger.warning("AI_PROVIDER=openrouter but OPENROUTER_API_KEY is empty; using deterministic")
            return DeterministicProvider()
        return OpenRouterProvider(
            settings.openrouter_api_key,
            settings.openrouter_model,
            settings.ai_request_timeout,
        )

    # auto
    if await _ollama_reachable(settings.ollama_url):
        return OllamaProvider(
            settings.ollama_url, settings.ollama_model, settings.ai_request_timeout
        )
    if settings.openrouter_api_key:
        return OpenRouterProvider(
            settings.openrouter_api_key,
            settings.openrouter_model,
            settings.ai_request_timeout,
        )
    return DeterministicProvider()
