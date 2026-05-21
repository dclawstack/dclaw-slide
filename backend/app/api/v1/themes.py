from fastapi import APIRouter, HTTPException

from app.services.themes import Theme, get_theme, list_themes

router = APIRouter()


@router.get("", response_model=list[Theme])
async def get_themes() -> list[Theme]:
    return list_themes()


@router.get("/{theme_id}", response_model=Theme)
async def get_one_theme(theme_id: str) -> Theme:
    theme = get_theme(theme_id)
    if theme is None:
        raise HTTPException(status_code=404, detail="theme not found")
    return theme
