import uuid
from datetime import datetime, timezone
from random import randint

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class CreateDeckRequest(BaseModel):
    title: str
    template: str


class SlideItem(BaseModel):
    title: str
    content: str


class DeckResponse(BaseModel):
    id: str
    title: str
    template: str
    slides: list[SlideItem]
    duration_minutes: int
    status: str
    created_at: str


@router.post("/decks")
async def create_deck(req: CreateDeckRequest):
    return DeckResponse(
        id=str(uuid.uuid4()),
        title=req.title,
        template=req.template,
        slides=[
            SlideItem(title="Slide 1", content="Content"),
        ],
        duration_minutes=randint(5, 30),
        status="draft",
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/decks/{id}/slides")
async def get_deck_slides(id: str):
    return [
        SlideItem(title="Slide 1", content="Content"),
    ]
