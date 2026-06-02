from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.db import get_db
from services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    return SettingsService.get_settings(db)


@router.put("/")
def update_settings(settings_data: dict, db: Session = Depends(get_db)):
    try:
        return SettingsService.update_settings(db, settings_data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
