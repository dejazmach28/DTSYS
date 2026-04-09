import uuid
from typing import Dict
from fastapi import WebSocket
import asyncio

from app.core.logging import get_logger

log = get_logger(__name__)


class ConnectionManager:
    """Tracks all active device WebSocket connections."""

    def __init__(self):
        # device_id (UUID) -> WebSocket
        self._connections: Dict[uuid.UUID, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, device_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if device_id in self._connections:
                # Disconnect old connection for same device
                old_ws = self._connections[device_id]
                try:
                    await old_ws.close(code=1000)
                except Exception:
                    pass
            self._connections[device_id] = websocket
        log.info("device_connected", device_id=str(device_id), total=len(self._connections))

    async def disconnect(self, device_id: uuid.UUID) -> None:
        async with self._lock:
            self._connections.pop(device_id, None)
        log.info("device_disconnected", device_id=str(device_id), total=len(self._connections))

    async def send_to_device(self, device_id: uuid.UUID, message: dict) -> bool:
        """Send a JSON message to a specific device. Returns True if sent."""
        ws = self._connections.get(device_id)
        if ws is None:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception as e:
            log.warning("send_failed", device_id=str(device_id), error=str(e))
            await self.disconnect(device_id)
            return False

    def is_connected(self, device_id: uuid.UUID) -> bool:
        return device_id in self._connections

    @property
    def online_device_ids(self) -> list[uuid.UUID]:
        return list(self._connections.keys())

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton shared across the app lifecycle
manager = ConnectionManager()
