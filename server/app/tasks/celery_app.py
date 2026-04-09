from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "dtsys",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.alert_tasks",
        "app.tasks.cleanup_tasks",
        "app.tasks.email_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.scheduler_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "check-offline-devices": {
            "task": "app.tasks.alert_tasks.check_offline_devices",
            "schedule": 60.0,  # every 60 seconds
        },
        "cleanup-old-metrics": {
            "task": "app.tasks.cleanup_tasks.cleanup_old_metrics",
            "schedule": crontab(hour=2, minute=0),  # daily at 2am
        },
        "run-scheduled-commands": {
            "task": "app.tasks.scheduler_tasks.run_scheduled_commands",
            "schedule": 60.0,
        },
    },
)
