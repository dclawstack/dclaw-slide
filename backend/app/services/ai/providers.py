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


_PITCH_SECTIONS = [
    ("Hook", "title-only", "- Why now\n- Who this is for"),
    ("Problem", "title-bullets", "- The pain we measured\n- Why incumbents miss it"),
    ("Solution", "title-bullets", "- Our wedge\n- Demo screenshot"),
    ("Why now", "title-bullets", "- Tailwind 1\n- Tailwind 2"),
    ("Market", "title-bullets", "- TAM / SAM / SOM\n- Beachhead"),
    ("Traction", "title-bullets", "- Pilots\n- Revenue / engagement"),
    ("Business model", "title-bullets", "- Pricing\n- Unit economics"),
    ("Why us", "title-bullets", "- Founding insight\n- Why we win"),
    ("Roadmap", "title-bullets", "- Next 90 days\n- Next 12 months"),
    ("Ask", "title-bullets", "- The round\n- Use of funds"),
]

_REPORT_SECTIONS = [
    ("Executive summary", "title-only", "- Key result\n- One-line outcome"),
    ("Methodology", "title-bullets", "- Data sources\n- Time window"),
    ("Findings", "title-bullets", "- Finding 1\n- Finding 2\n- Finding 3"),
    ("Deep dive", "two-column", "- Left: data\n- Right: interpretation"),
    ("Risks", "title-bullets", "- Risk 1\n- Risk 2"),
    ("Recommendations", "title-bullets", "- Action 1\n- Action 2"),
    ("Appendix", "section-header", ""),
]

_TRAINING_SECTIONS = [
    ("Welcome", "title-only", "- What you'll learn"),
    ("Why this matters", "title-bullets", "- Outcome\n- Time investment"),
    ("Core concept", "title-bullets", "- Definition\n- Example"),
    ("Walkthrough", "two-column", "- Step\n- Screenshot"),
    ("Practice", "title-bullets", "- Exercise\n- Checkpoint"),
    ("Q&A", "section-header", ""),
]


def _section_template(deck_type: str) -> list[tuple[str, str, str]]:
    if deck_type == "report":
        return _REPORT_SECTIONS
    if deck_type == "training":
        return _TRAINING_SECTIONS
    return _PITCH_SECTIONS


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
        template = _section_template(deck_type)
        target = max(1, min(target_slides, 16))
        prompt_hint = prompt.strip()[:160] or "Untitled deck"
        # If the user wants more slides than the template has, fan out with
        # prompt-derived "deep dive" slides instead of leaking "TODO" strings.
        sections: list[tuple[str, str, str]] = list(template[:target])
        extras = max(0, target - len(template))
        for n in range(1, extras + 1):
            sections.append(
                (
                    f"Deep dive {n}",
                    "title-bullets",
                    f"- Additional angle on: {prompt_hint}\n- Supporting evidence\n- Open question",
                )
            )
        out: list[GeneratedSlide] = []
        for idx, (title, layout, body) in enumerate(sections):
            if idx == 0:
                title = prompt_hint if len(prompt_hint) <= 60 else f"{prompt_hint[:57]}…"
                body = "- " + (prompt.strip() or "Built with DClaw Slide")
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


def _coerce_slides(raw: dict, target_slides: int) -> list[GeneratedSlide]:
    slides_raw = raw.get("slides") if isinstance(raw, dict) else None
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

    async def _chat(self, system: str, user: str) -> dict:
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
        return json.loads(content)

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

    async def _chat(self, system: str, user: str) -> dict:
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
        return json.loads(content)

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
