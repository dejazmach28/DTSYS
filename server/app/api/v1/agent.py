import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from app.version import VERSION

router = APIRouter(prefix="/agent", tags=["agent"])

# Project root dist/ directory — two levels above server/app/api/v1/
_DEFAULT_DIST = str(Path(__file__).resolve().parents[4] / "dist")


@router.get("/version")
async def get_agent_version(
    request: Request,
    platform: str = Query("linux"),
    arch: str = Query("amd64"),
):
    base_url = str(request.base_url).rstrip("/")
    dist_version = _read_dist_version()
    return {
        "version": dist_version or VERSION,
        "download_url": f"{base_url}/api/v1/agent/download?arch={arch}&platform={platform}",
        "changelog_url": f"{base_url}/CHANGELOG.md",
        "required": False,
    }


@router.get("/download")
async def download_agent(
    platform: str = Query(..., pattern="^(linux|darwin|windows)$"),
    arch: str = Query(..., pattern="^(amd64|arm64)$"),
):
    dist_dir = Path(os.getenv("AGENT_DIST_DIR", _DEFAULT_DIST))
    suffix = ".exe" if platform == "windows" else ""
    filename = f"dtsys-agent-{platform}-{arch}{suffix}"
    path = dist_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Agent binary not found: {filename}")
    return FileResponse(str(path), filename=filename, media_type="application/octet-stream")


def _read_dist_version() -> str | None:
    dist_dir = Path(os.getenv("AGENT_DIST_DIR", _DEFAULT_DIST))
    version_path = dist_dir / "version.txt"
    if not version_path.exists():
        return None
    try:
        return version_path.read_text(encoding="utf-8").strip()
    except Exception:
        return None
