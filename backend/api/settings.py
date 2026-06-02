from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    due_soon_days: int | None = None
    large_payment_threshold: float | None = None


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    return SettingsService.get_settings(db)


@router.put("/")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    try:
        return SettingsService.update_settings(db, payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
