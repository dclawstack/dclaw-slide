"""In-process WebSocket room manager for presence + edit broadcast.

This is intentionally minimal (no CRDT) — the design ships a "presence + push"
collaboration UX:
  - Multiple users join a room scoped to a presentation_id.
  - The server tracks who's online and broadcasts "X is here / left" events.
  - When any client modifies the deck via REST, the route handler asks this
    manager to broadcast an "invalidate" event so other tabs refetch.

Single-process by design (Yjs / CRDT is a C2 follow-up). For horizontal scale
we'd swap the in-memory dict for Redis pub/sub.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class _Member:
    socket: WebSocket
    user_id: str  # opaque, client-chosen


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[UUID, dict[str, _Member]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def join(
        self, presentation_id: UUID, socket: WebSocket, user_id: str | None = None
    ) -> str:
        await socket.accept()
        connection_id = uuid4().hex
        member = _Member(socket=socket, user_id=user_id or f"anon-{connection_id[:6]}")
        async with self._lock:
            self._rooms[presentation_id][connection_id] = member
        await self._broadcast(
            presentation_id,
            {"event": "presence", "users": self._presence(presentation_id)},
        )
        return connection_id

    async def leave(self, presentation_id: UUID, connection_id: str) -> None:
        async with self._lock:
            room = self._rooms.get(presentation_id)
            if not room or connection_id not in room:
                return
            del room[connection_id]
            if not room:
                del self._rooms[presentation_id]
        await self._broadcast(
            presentation_id,
            {"event": "presence", "users": self._presence(presentation_id)},
        )

    def _presence(self, presentation_id: UUID) -> list[str]:
        return sorted({m.user_id for m in self._rooms.get(presentation_id, {}).values()})

    async def _broadcast(self, presentation_id: UUID, payload: dict[str, Any]) -> None:
        room = self._rooms.get(presentation_id)
        if not room:
            return
        dead: list[str] = []
        for connection_id, member in list(room.items()):
            try:
                await member.socket.send_json(payload)
            except Exception as exc:
                logger.debug("ws send failed (%s); dropping connection", exc)
                dead.append(connection_id)
        for connection_id in dead:
            room.pop(connection_id, None)

    async def notify_invalidate(self, presentation_id: UUID, reason: str) -> None:
        """Tell every other client viewing this deck to refetch."""
        await self._broadcast(
            presentation_id, {"event": "invalidate", "reason": reason}
        )


# Process-wide singleton — fine for a single-replica MVP.
manager = RoomManager()
