from fastapi import APIRouter

from app.api.v1 import auth, devices, metrics, commands, commands_bulk, alerts, software, events, admin, agent, downloads

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(devices.router)
router.include_router(metrics.router)
router.include_router(commands.router)
router.include_router(commands_bulk.router)
router.include_router(alerts.router)
router.include_router(software.router)
router.include_router(events.router)
router.include_router(admin.router)
router.include_router(agent.router)
router.include_router(downloads.router)
