"""Agent binary download endpoint."""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

router = APIRouter(prefix="/agent", tags=["agent-download"])


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
