import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.device import Device
from app.models.software import SoftwareInventory
from app.models.user import User
from app.services.command_service import CommandService

router = APIRouter(prefix="/software-updates", tags=["software-updates"])


class SoftwareDispatchRequest(BaseModel):
    software_names: list[str]
    device_ids: list[uuid.UUID]


@router.get("/pending")
async def get_pending_updates(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(SoftwareInventory).where(SoftwareInventory.update_available)
    )
    packages = result.scalars().all()

    grouped: dict[str, dict] = {}
    for package in packages:
        current = grouped.setdefault(
            package.name,
            {
                "software_name": package.name,
                "current_versions": set(),
                "affected_device_ids": set(),
            },
        )
        if package.version:
            current["current_versions"].add(package.version)
        current["affected_device_ids"].add(str(package.device_id))

    return [
        {
            "software_name": name,
            "current_versions": sorted(data["current_versions"]),
            "affected_device_ids": sorted(data["affected_device_ids"]),
            "affected_count": len(data["affected_device_ids"]),
        }
        for name, data in sorted(grouped.items())
    ]


@router.post("/dispatch")
async def dispatch_updates(
    body: SoftwareDispatchRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    command_service = CommandService(db)
    devices_result = await db.execute(
        select(Device).where(Device.id.in_(body.device_ids))
    )
    devices = {device.id: device for device in devices_result.scalars().all()}

    dispatched = []
    for device_id in body.device_ids:
        device = devices.get(device_id)
        if device is None:
            continue
        command = await command_service.dispatch_command(
            device_id=device_id,
            command_type="shell",
            payload={"command": _build_update_command(device.os_type, body.software_names)},
            issued_by=current_user.id,
        )
        dispatched.append({
            "device_id": str(device_id),
            "command_id": str(command.id),
        })

    await db.commit()
    return {"dispatched": dispatched}


def _build_update_command(os_type: str, packages: list[str]) -> str:
    package_list = " ".join(packages)
    if os_type == "windows":
        return f'powershell -Command "if (Get-Command winget -ErrorAction SilentlyContinue) {{ {"; ".join([f"winget upgrade --exact --id {pkg} --silent" for pkg in packages])} }} elseif (Get-Command choco -ErrorAction SilentlyContinue) {{ choco upgrade -y {package_list} }} else {{ Write-Output \'No supported package manager found\' }}"'
    if os_type == "macos":
        return f"brew upgrade {package_list}"
    return f"if command -v apt-get >/dev/null 2>&1; then apt-get install -y {package_list}; elif command -v dnf >/dev/null 2>&1; then dnf update -y {package_list}; else echo 'No supported package manager found'; exit 1; fi"
