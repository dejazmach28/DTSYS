"""Agent binary download endpoint."""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

router = APIRouter(prefix="/agent", tags=["agent-download"])

_FALLBACK_VERSION = "1.3.0"
# Default: two levels up from server/ to the project root dist/
_DEFAULT_DIST = str(Path(__file__).resolve().parents[4] / "dist")


@router.get("/version")
async def agent_version(
    arch: str = Query("amd64", pattern="^(amd64|arm64)$"),
    platform: str = Query("linux", pattern="^(linux|darwin|windows)$"),
):
    version_file = Path(os.getenv("AGENT_DIST_DIR", _DEFAULT_DIST)) / "version.txt"
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
    dist_dir = Path(os.getenv("AGENT_DIST_DIR", _DEFAULT_DIST))
    suffix = ".exe" if platform == "windows" else ""
    filename = f"dtsys-agent-{platform}-{arch}{suffix}"
    path = dist_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Agent binary not found: {filename}")
    return FileResponse(str(path), filename=filename)
