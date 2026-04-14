"""Agent binary download endpoint."""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

router = APIRouter(prefix="/agent", tags=["agent-download"])

_FALLBACK_VERSION = "1.2.0"


@router.get("/version")
async def agent_version(
    arch: str = Query("amd64", pattern="^(amd64|arm64)$"),
    platform: str = Query("linux", pattern="^(linux|darwin|windows)$"),
):
    version_file = Path(os.getenv("AGENT_DIST_DIR", "./dist/")).resolve() / "version.txt"
    if version_file.exists():
        version = version_file.read_text().strip()
    else:
        version = _FALLBACK_VERSION
    return {
        "version": version,
        "download_url": f"/api/v1/agent/download?arch={arch}&platform={platform}",
        "required": False,
    }


@router.get("/download")
async def download_agent(
    arch: str = Query(..., pattern="^(amd64|arm64)$"),
    platform: str = Query(..., pattern="^(linux|darwin|windows)$"),
):
    dist_dir = Path(os.getenv("AGENT_DIST_DIR", "./dist/")).resolve()
    suffix = ".exe" if platform == "windows" else ""
    filename = f"dtsys-agent-{platform}-{arch}{suffix}"
    path = dist_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Agent binary not found")
    return FileResponse(path, filename=filename)
