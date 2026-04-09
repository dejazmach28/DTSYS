import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/downloads", tags=["downloads"])


@router.get("/{filename}")
async def download_agent(filename: str):
    dist_dir = Path(os.getenv("AGENT_DIST_DIR", "./dist/agents/")).resolve()
    file_path = (dist_dir / filename).resolve()

    if dist_dir not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path=file_path)
