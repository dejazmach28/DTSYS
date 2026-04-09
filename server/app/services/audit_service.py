from app.models.audit_log import AuditLog


async def log_action(
    db,
    user,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip: str | None = None,
    details: dict | None = None,
    username: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=getattr(user, "id", None),
        username=username or getattr(user, "username", "anonymous"),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip,
        details=details,
    )
    if hasattr(db, "add"):
        db.add(entry)
    if hasattr(db, "flush"):
        await db.flush()
    return entry
