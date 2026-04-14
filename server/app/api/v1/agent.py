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
    return {
        "version": VERSION,
        "download_url": f"{base_url}/api/v1/agent/download?arch={arch}&platform={platform}",
    }
