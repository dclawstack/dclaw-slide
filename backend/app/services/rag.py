"""Pure-Python TF-IDF retrieval over brand references.

Deliberately tiny and dependency-free:
  - No sklearn, no numpy, no faiss, no pgvector.
  - Works identically on SQLite (dev) and Postgres (prod).
  - Recomputes IDF per query because the corpus is small (workspace-scoped,
    expected size << 10k). Swap for a persistent index in C2 once we have
    a real reason to.

The output is a ranked list of (reference, score) tuples; callers can
truncate to top-K and inline the bodies into an LLM prompt.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

from app.models.brand_reference import BrandReference

_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9_-]+")

_STOPWORDS = frozenset(
    {
        "a", "an", "and", "the", "to", "of", "for", "in", "on", "is", "are",
        "with", "by", "as", "at", "or", "be", "this", "that", "these", "those",
        "we", "our", "us", "you", "your", "they", "their", "it", "its", "i",
    }
)


def _tokenize(text: str) -> list[str]:
    return [
        t.lower()
        for t in _TOKEN.findall(text)
        if len(t) > 1 and t.lower() not in _STOPWORDS
    ]


@dataclass
class RetrievalHit:
    reference: BrandReference
    score: float


def rank(query: str, references: list[BrandReference]) -> list[RetrievalHit]:
    if not query.strip() or not references:
        return []

    docs = [_tokenize(f"{r.title} {r.body}") for r in references]
    n = len(docs)
    df = Counter()
    for tokens in docs:
        for token in set(tokens):
            df[token] += 1
    idf = {t: math.log((n + 1) / (df[t] + 1)) + 1.0 for t in df}

    q_tokens = _tokenize(query)
    if not q_tokens:
        return []

    q_vec = Counter(q_tokens)
    q_norm = math.sqrt(sum((freq * idf.get(t, 0.0)) ** 2 for t, freq in q_vec.items()))

    hits: list[RetrievalHit] = []
    for ref, tokens in zip(references, docs):
        d_vec = Counter(tokens)
        d_norm = math.sqrt(sum((freq * idf.get(t, 0.0)) ** 2 for t, freq in d_vec.items()))
        if q_norm == 0 or d_norm == 0:
            continue
        dot = sum(
            q_vec[t] * d_vec.get(t, 0) * idf.get(t, 0.0) ** 2 for t in q_vec
        )
        score = dot / (q_norm * d_norm)
        if score > 0:
            hits.append(RetrievalHit(reference=ref, score=score))

    hits.sort(key=lambda h: h.score, reverse=True)
    return hits


def format_for_prompt(hits: list[RetrievalHit], max_chars: int = 1200) -> str:
    """Render top hits as a compact context block for an LLM prompt."""
    if not hits:
        return ""
    chunks: list[str] = ["BRAND REFERENCES (use this voice and vocabulary):"]
    used = 0
    for hit in hits:
        snippet = hit.reference.body.strip()
        if len(snippet) > 400:
            snippet = snippet[:400] + "…"
        block = f"- {hit.reference.title}: {snippet}"
        if used + len(block) > max_chars:
            break
        chunks.append(block)
        used += len(block)
    return "\n".join(chunks)
