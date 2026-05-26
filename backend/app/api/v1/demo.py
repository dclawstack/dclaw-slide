"""Demo seed/clear endpoints. Self-contained so it can be removed in one delete.

Wiring: registered in app.api.main alongside the other v1 routers.
Removal: delete this file, delete the two `from app.api.v1 import demo` /
`include_router(demo.router, ...)` lines in app/api/main.py, and remove the
`<SeedControls />` block in frontend/src/app/page.tsx.
"""

from __future__ import annotations

import random
from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.utils import utc_now
from app.models.analytics import SlideAnalyticsEvent
from app.models.brand_kit import BrandKit
from app.models.brand_reference import BrandReference
from app.models.presentation import Presentation, Slide
from app.models.share_link import ShareLink
from app.services.layout import pick_layout
from app.services.share import hash_password, new_token

router = APIRouter()

DEMO_WORKSPACE = "default"


# ── Seed content ──────────────────────────────────────────────────────────────

_SEED_BRAND_KIT = {
    "name": "Acme Robotics",
    "primary_color": "#0F172A",
    "accent_color": "#EC4899",
    "neutral_color": "#F8FAFC",
    "font_heading": "\"Source Serif Pro\", serif",
    "font_body": "Inter, system-ui, sans-serif",
    "logo_url": "",
    "voice_dos": (
        "Lead with the customer outcome.\n"
        "Use concrete numbers — \"4x faster\", not \"much faster\".\n"
        "Short sentences. Plain English. No jargon."
    ),
    "voice_donts": (
        "Don't use \"synergy\", \"leverage\", or \"unlock value\".\n"
        "Don't open a slide with a definition.\n"
        "Don't end on a question if you want a decision."
    ),
}

_SEED_BRAND_REFERENCES = [
    {
        "title": "Series A pitch — opening section",
        "source_kind": "deck",
        "body": (
            "Warehouses lose $90B a year to picking errors. Acme's vision-guided "
            "arms cut that loss by 4x in the first quarter and pay themselves "
            "back in eleven months. We've shipped to 38 sites; the room-of-100 "
            "pilot at Maersk went live last Tuesday with zero downtime."
        ),
    },
    {
        "title": "Q3 board update — narrative",
        "source_kind": "doc",
        "body": (
            "Revenue grew 62% quarter-over-quarter. Gross margin held at 71% "
            "despite a one-time tariff hit. The two strategic risks are "
            "lead-time on the F300 actuators and the EU AI Act — both have "
            "concrete mitigations and dated owners."
        ),
    },
    {
        "title": "Website — product hero copy",
        "source_kind": "url",
        "body": (
            "Acme Robotics: arms that see. Vision-guided picking that learns "
            "your SKU mix in a weekend and runs for years. No teach pendant. "
            "No retrofit. Just plug, scan, ship."
        ),
    },
]

_SEED_PRESENTATIONS = [
    {
        "title": "Acme — Series B Pitch",
        "theme_id": "pitch-classic",
        "template": "pitch-classic",
        "status": "draft",
        "share": {"password": "investor2026", "expires_in_days": 14},
        "slides": [
            {
                "title": "Acme Robotics",
                "body": "Arms that see. Series B, May 2026.",
                "layout": "title-only",
            },
            {
                "title": "The $90B problem",
                "body": (
                    "- Global warehouses lose $90B/year to picking errors\n"
                    "- The error rate has barely moved in a decade\n"
                    "- Labor shortages mean fewer humans to catch mistakes\n"
                    "- Existing robotics fails on mixed-SKU pallets\n"
                    "- Operators want one system, not eight integrators"
                ),
            },
            {"title": "Part One — Why now", "body": "", "layout": "section-header"},
            {
                "title": "Vision-guided picking, productized",
                "body": (
                    "- Onboards a new SKU in 90 seconds, not 90 minutes\n"
                    "- Runs on commodity GPUs — no proprietary silicon\n"
                    "- Pays back in 11 months at the median customer\n"
                    "- 99.4% pick accuracy across 38 live deployments\n"
                    "- Field-replaceable end effectors, no service contract lock-in"
                ),
            },
            {
                "title": "Traction",
                "body": (
                    "- 38 paying customers across NA + EU\n"
                    "- $14.2M ARR, growing 62% quarter-over-quarter"
                ),
                "layout": "two-column",
            },
            {
                "title": "What customers say",
                "body": (
                    "\"We replaced four humans and one consultant in the first month. "
                    "Acme paid for itself before Black Friday.\""
                ),
                "layout": "quote",
            },
            {
                "title": "The ask",
                "body": (
                    "- $40M Series B to fund EU expansion and the F300 platform\n"
                    "- Lead investor with operating expertise in industrials\n"
                    "- Board seat + 18-month runway to cashflow positive\n"
                    "- Closing the round by July 31"
                ),
            },
        ],
    },
    {
        "title": "Q3 2026 Board Review",
        "theme_id": "report-minimal",
        "template": "report-minimal",
        "status": "published",
        "share": None,
        "slides": [
            {
                "title": "Q3 2026 Board Review",
                "body": "Acme Robotics · prepared for the board, 2026-05-22",
                "layout": "title-only",
            },
            {
                "title": "Headline numbers",
                "body": (
                    "- Revenue: $14.2M (+62% QoQ, +210% YoY)\n"
                    "- Gross margin: 71% (held flat despite tariff)\n"
                    "- Net new logos: 11, including two Fortune-500 pilots\n"
                    "- Cash on hand: $22M; runway 19 months at current burn"
                ),
            },
            {
                "title": "What worked",
                "body": (
                    "- Channel partnership with Maersk — 3 sites in 90 days\n"
                    "- F300 actuator beta — zero field failures across 600 units"
                ),
                "layout": "two-column",
            },
            {"title": "Risks", "body": "", "layout": "section-header"},
            {
                "title": "Two risks worth watching",
                "body": (
                    "- F300 lead-time slipped from 8 to 14 weeks; dual-sourcing in motion\n"
                    "- EU AI Act compliance review opens Q4; legal engaged, no blockers yet\n"
                    "- Neither risk affects the FY guide\n"
                    "- Owners and dates listed on the appendix slide\n"
                    "- We'll have a closed-loop update at the December board"
                ),
            },
            {
                "title": "Looking ahead",
                "body": (
                    "- Q4 target: $19M revenue, 14 net new logos\n"
                    "- Launch the developer SDK on November 4\n"
                    "- Begin hiring an EU country manager (Amsterdam)\n"
                    "- Close the Series B by end of Q1 2027"
                ),
            },
        ],
    },
    {
        "title": "New Hire Onboarding — Week 1",
        "theme_id": "training-warm",
        "template": "training-warm",
        "status": "draft",
        "share": None,
        "slides": [
            {
                "title": "Welcome to Acme",
                "body": "Your first week, in seven slides.",
                "layout": "title-only",
            },
            {
                "title": "How we work",
                "body": (
                    "- Async by default — meetings are the exception\n"
                    "- Write the doc before the meeting, not after\n"
                    "- Disagree in PRs, decide in person, ship in a week\n"
                    "- One on-call rotation; everyone joins after day 90\n"
                    "- Fridays are no-meeting, no-Slack focus blocks"
                ),
            },
            {
                "title": "Your first 30 days",
                "body": (
                    "- Week 1: shadow a deployment, ship a documentation fix\n"
                    "- Week 2: own a small feature end-to-end with a buddy\n"
                    "- Weeks 3-4: lead a customer call, present at all-hands"
                ),
            },
            {
                "title": "One thing to remember",
                "body": "\"Ship the smallest thing that proves the point.\"",
                "layout": "quote",
            },
        ],
    },
]


# ── Seeding ───────────────────────────────────────────────────────────────────


def _is_demo_session(session_id: str) -> bool:
    return session_id.startswith("demo-")


async def _delete_all_workspace_data(db: AsyncSession, workspace_id: str) -> dict:
    """Wipe demo + user data for the workspace. Cascade handles slides/links/events."""
    deleted_pres = await db.execute(
        delete(Presentation).where(Presentation.workspace_id == workspace_id)
    )
    deleted_refs = await db.execute(
        delete(BrandReference).where(BrandReference.workspace_id == workspace_id)
    )
    deleted_kits = await db.execute(
        delete(BrandKit).where(BrandKit.workspace_id == workspace_id)
    )
    await db.commit()
    return {
        "presentations": deleted_pres.rowcount or 0,
        "brand_references": deleted_refs.rowcount or 0,
        "brand_kits": deleted_kits.rowcount or 0,
    }


def _seed_analytics(
    db: AsyncSession,
    presentation_id: UUID,
    slides: list[Slide],
    sessions: int = 12,
) -> int:
    """Generate plausible per-slide dwell/advance events so the heatmap renders."""
    rng = random.Random(str(presentation_id))
    base_time = utc_now() - timedelta(days=3)
    events = 0
    for s_idx in range(sessions):
        session_id = f"demo-{presentation_id.hex[:8]}-{s_idx:02d}"
        t = base_time + timedelta(minutes=s_idx * 7)
        dropout_at = rng.randint(2, len(slides))  # most sessions complete; some drop
        for position, slide in enumerate(slides):
            if position >= dropout_at:
                db.add(
                    SlideAnalyticsEvent(
                        presentation_id=presentation_id,
                        slide_id=slide.id,
                        session_id=session_id,
                        event_type="dropoff",
                        dwell_ms=0,
                        created_at=t,
                    )
                )
                events += 1
                break
            dwell_ms = rng.randint(4_000, 28_000)
            db.add(
                SlideAnalyticsEvent(
                    presentation_id=presentation_id,
                    slide_id=slide.id,
                    session_id=session_id,
                    event_type="slide_view",
                    dwell_ms=0,
                    created_at=t,
                )
            )
            db.add(
                SlideAnalyticsEvent(
                    presentation_id=presentation_id,
                    slide_id=slide.id,
                    session_id=session_id,
                    event_type="dwell",
                    dwell_ms=dwell_ms,
                    created_at=t + timedelta(milliseconds=dwell_ms),
                )
            )
            events += 2
            t += timedelta(milliseconds=dwell_ms + rng.randint(500, 2_500))
        else:
            db.add(
                SlideAnalyticsEvent(
                    presentation_id=presentation_id,
                    slide_id=slides[-1].id,
                    session_id=session_id,
                    event_type="finish",
                    dwell_ms=0,
                    created_at=t,
                )
            )
            events += 1
    return events


@router.post("/seed")
async def seed_demo(db: AsyncSession = Depends(get_db)) -> dict:
    """Reset the default workspace and load a realistic demo dataset."""
    await _delete_all_workspace_data(db, DEMO_WORKSPACE)

    kit = BrandKit(workspace_id=DEMO_WORKSPACE, **_SEED_BRAND_KIT)
    db.add(kit)

    for ref in _SEED_BRAND_REFERENCES:
        db.add(BrandReference(workspace_id=DEMO_WORKSPACE, **ref))

    presentations_made = 0
    slides_made = 0
    analytics_events = 0
    share_links_made = 0

    for spec in _SEED_PRESENTATIONS:
        pres = Presentation(
            id=uuid4(),
            workspace_id=DEMO_WORKSPACE,
            title=spec["title"],
            template=spec["template"],
            theme_id=spec["theme_id"],
            status=spec["status"],
        )
        db.add(pres)
        slide_objs: list[Slide] = []
        for position, s in enumerate(spec["slides"]):
            layout = s.get("layout") or pick_layout(s["title"], s["body"])
            slide = Slide(
                id=uuid4(),
                presentation_id=pres.id,
                position=position,
                title=s["title"],
                body=s["body"],
                layout=layout,
                speaker_notes=s.get("speaker_notes", ""),
            )
            db.add(slide)
            slide_objs.append(slide)
        slides_made += len(slide_objs)
        presentations_made += 1

        if spec.get("share"):
            share = spec["share"]
            db.add(
                ShareLink(
                    presentation_id=pres.id,
                    token=new_token(),
                    password_hash=hash_password(share.get("password", "")),
                    allow_edit=False,
                    expires_at=(
                        utc_now() + timedelta(days=share["expires_in_days"])
                        if share.get("expires_in_days")
                        else None
                    ),
                    view_count=0,
                )
            )
            share_links_made += 1

        analytics_events += _seed_analytics(db, pres.id, slide_objs)

    await db.commit()

    return {
        "status": "seeded",
        "workspace_id": DEMO_WORKSPACE,
        "brand_kit": 1,
        "brand_references": len(_SEED_BRAND_REFERENCES),
        "presentations": presentations_made,
        "slides": slides_made,
        "share_links": share_links_made,
        "analytics_events": analytics_events,
    }


@router.post("/clear")
async def clear_demo(db: AsyncSession = Depends(get_db)) -> dict:
    """Wipe the default workspace back to an empty state."""
    counts = await _delete_all_workspace_data(db, DEMO_WORKSPACE)
    return {"status": "cleared", "workspace_id": DEMO_WORKSPACE, **counts}
