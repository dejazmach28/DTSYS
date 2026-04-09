import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings
from app.models.alert import Alert
from app.models.device import Device


def send_alert_email(to: str, alert: Alert, device: Device) -> None:
    settings = get_settings()
    if not settings.EMAIL_ENABLED or not settings.SMTP_HOST:
        return

    severity_color = {
        "critical": "#dc2626",
        "warning": "#f59e0b",
        "info": "#2563eb",
    }.get(alert.severity, "#2563eb")

    base_url = settings.BASE_URL.rstrip("/")
    device_url = f"{base_url}/devices/{device.id}"

    message = MIMEMultipart("alternative")
    message["Subject"] = f"[DTSYS] {alert.severity.upper()}: {alert.alert_type} on {device.hostname}"
    message["From"] = settings.SMTP_FROM
    message["To"] = to

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="background: {severity_color}; color: white; padding: 16px 20px; font-size: 18px; font-weight: 600;">
            DTSYS Alert: {alert.alert_type}
          </div>
          <div style="padding: 20px; color: #0f172a;">
            <h3 style="margin: 0 0 12px;">Device Info</h3>
            <p><strong>Hostname:</strong> {device.label or device.hostname}</p>
            <p><strong>IP:</strong> {device.ip_address or 'Unknown'}</p>
            <p><strong>OS:</strong> {device.os_version or device.os_type}</p>
            <h3 style="margin: 20px 0 12px;">Alert Details</h3>
            <p><strong>Severity:</strong> {alert.severity}</p>
            <p><strong>Message:</strong> {alert.message}</p>
            <p><strong>Time:</strong> {alert.created_at.isoformat() if alert.created_at else 'Unknown'}</p>
            <p style="margin-top: 20px;">
              <a href="{device_url}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
                Open Device
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
    """
    message.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to], message.as_string())
