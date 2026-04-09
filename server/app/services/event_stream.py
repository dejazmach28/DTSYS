import asyncio


class AlertEventStream:
    def __init__(self) -> None:
        self._queues: set[asyncio.Queue[dict]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[dict]:
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._queues.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[dict]) -> None:
        async with self._lock:
            self._queues.discard(queue)

    async def publish(self, payload: dict) -> None:
        async with self._lock:
            queues = list(self._queues)
        for queue in queues:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    queue.put_nowait(payload)
                except asyncio.QueueFull:
                    pass


alert_event_stream = AlertEventStream()
