from pydantic import BaseModel


class Theme(BaseModel):
    id: str
    name: str
    description: str
    accent: str
    background: str
    font_heading: str
    font_body: str
    cover_emoji: str


THEMES: list[Theme] = [
    Theme(
        id="pitch-classic",
        name="Pitch — Classic",
        description="Investor-friendly default. Crisp serif headings, plenty of whitespace.",
        accent="#EC4899",
        background="#FFFFFF",
        font_heading="\"Source Serif Pro\", serif",
        font_body="Inter, system-ui, sans-serif",
        cover_emoji="🚀",
    ),
    Theme(
        id="pitch-bold",
        name="Pitch — Bold",
        description="High-contrast, oversized headlines. For Series A founders.",
        accent="#FACC15",
        background="#0F172A",
        font_heading="\"Space Grotesk\", sans-serif",
        font_body="Inter, system-ui, sans-serif",
        cover_emoji="⚡",
    ),
    Theme(
        id="report-minimal",
        name="Report — Minimal",
        description="Quiet, data-dense layout for quarterly reports.",
        accent="#0EA5E9",
        background="#F8FAFC",
        font_heading="Inter, system-ui, sans-serif",
        font_body="Inter, system-ui, sans-serif",
        cover_emoji="📊",
    ),
    Theme(
        id="training-warm",
        name="Training — Warm",
        description="Friendly tone, large body text, ideal for onboarding decks.",
        accent="#F97316",
        background="#FFF7ED",
        font_heading="\"Plus Jakarta Sans\", sans-serif",
        font_body="\"Plus Jakarta Sans\", sans-serif",
        cover_emoji="🎓",
    ),
    Theme(
        id="dark-investor",
        name="Dark — Investor",
        description="Late-night demo aesthetic. White text on near-black.",
        accent="#A78BFA",
        background="#0B0B12",
        font_heading="\"IBM Plex Sans\", sans-serif",
        font_body="\"IBM Plex Sans\", sans-serif",
        cover_emoji="🌙",
    ),
]


def list_themes() -> list[Theme]:
    return THEMES


def get_theme(theme_id: str) -> Theme | None:
    return next((t for t in THEMES if t.id == theme_id), None)
