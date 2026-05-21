from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.realtime import manager

router = APIRouter()


@router.websocket("/presentations/{presentation_id}")
async def presentation_room(
    websocket: WebSocket,
    presentation_id: UUID,
    user_id: str | None = Query(default=None),
) -> None:
    connection_id = await manager.join(presentation_id, websocket, user_id)
    try:
        while True:
            # Clients may send keepalive pings or future cursor frames; we just
            # consume them so the loop stays alive.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.leave(presentation_id, connection_id)
