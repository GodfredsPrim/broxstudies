from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.auth_service import AuthService

router = APIRouter()
auth_service = AuthService()


@router.get("/{asset_id}", include_in_schema=False)
async def get_media_asset(asset_id: str):
    if len(asset_id) != 32 or any(char not in "0123456789abcdef" for char in asset_id.lower()):
        raise HTTPException(status_code=404, detail="Media not found.")

    asset = auth_service.get_media_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Media not found.")

    filename = Path(asset["filename"]).name.replace('"', "")
    return Response(
        content=bytes(asset["data"]),
        media_type=asset["content_type"],
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
