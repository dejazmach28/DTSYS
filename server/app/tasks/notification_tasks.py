import httpx

from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.notification_tasks.deliver_webhook_notification")
def deliver_webhook_notification(webhook_url: str, payload: dict) -> None:
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(webhook_url, json=payload)
    except Exception:
        return
