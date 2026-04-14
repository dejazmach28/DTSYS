import os
from pathlib import Path
from fastapi import APIRouter, Query, Request

from app.version import VERSION

router = APIRouter(prefix="/agent", tags=["agent"])


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


def _read_dist_version() -> str | None:
    dist_dir = Path(os.getenv("AGENT_DIST_DIR", "./dist/")).resolve()
    version_path = dist_dir / "version.txt"
    if not version_path.exists():
        return None
    try:
        return version_path.read_text(encoding="utf-8").strip()
    except Exception:
        return None
