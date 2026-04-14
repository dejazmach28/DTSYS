"""Installer endpoints for agent bootstrap scripts."""

import os

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()
SCRIPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../scripts"))


@router.get("/install-agent.sh", include_in_schema=False)
async def install_script_linux():
    path = os.path.join(SCRIPTS_DIR, "install-agent.sh")
    return FileResponse(path, media_type="text/plain", filename="install-agent.sh")


@router.get("/install-agent.ps1", include_in_schema=False)
async def install_script_windows():
    path = os.path.join(SCRIPTS_DIR, "install-agent.ps1")
    return FileResponse(path, media_type="text/plain", filename="install-agent.ps1")
