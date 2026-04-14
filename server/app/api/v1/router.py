from fastapi import APIRouter

from app.api.v1 import (
    activity_stream,
    admin,
    agent,
    agent_download,
    alerts,
    auth,
    commands,
    commands_bulk,
    devices,
    downloads,
    enroll,
    event_stream,
    events,
    metrics,
    notification_rules,
    organizations,
    push_tokens,
    scheduled_commands,
    software_catalog,
    software_updates,
    software,
    groups,
    inventory,
    tags,
    saved_commands,
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
router.include_router(activity_stream.router)
router.include_router(admin.router)
router.include_router(agent.router)
router.include_router(agent_download.router)
router.include_router(downloads.router)
router.include_router(enroll.router)
router.include_router(tags.router)
router.include_router(groups.router)
router.include_router(inventory.router)
router.include_router(saved_commands.router)
router.include_router(scheduled_commands.router)
router.include_router(notification_rules.router)
router.include_router(software_catalog.router)
router.include_router(software_updates.router)
router.include_router(organizations.router)
router.include_router(push_tokens.router)
