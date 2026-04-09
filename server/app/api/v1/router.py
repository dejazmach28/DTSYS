from fastapi import APIRouter

from app.api.v1 import (
    admin,
    agent,
    alerts,
    auth,
    commands,
    commands_bulk,
    devices,
    downloads,
    event_stream,
    events,
    metrics,
    notification_rules,
    scheduled_commands,
    software,
    tags,
)

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(devices.router)
router.include_router(metrics.router)
router.include_router(commands.router)
router.include_router(commands_bulk.router)
router.include_router(alerts.router)
router.include_router(software.router)
router.include_router(events.router)
router.include_router(event_stream.router)
router.include_router(admin.router)
router.include_router(agent.router)
router.include_router(downloads.router)
router.include_router(tags.router)
router.include_router(scheduled_commands.router)
router.include_router(notification_rules.router)
