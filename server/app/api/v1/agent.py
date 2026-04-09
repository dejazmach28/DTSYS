import os

from fastapi import APIRouter, Query, Request

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/version")
async def get_agent_version(
    request: Request,
    platform: str = Query("linux"),
    arch: str = Query("amd64"),
):
    version = os.getenv("AGENT_VERSION", "0.1.0")
    base_url = str(request.base_url).rstrip("/")
    return {
        "version": version,
        "download_url": f"{base_url}/downloads/dtsys-agent-{platform}-{arch}",
    }
