from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from services.category_service import CategoryService

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str


@router.get("/")
def get_all_categories(db: Session = Depends(get_db)):
    return CategoryService.get_all(db)


@router.post("/", status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required")
    try:
        return CategoryService.create(db, name)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.put("/{category_id}")
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required")
    try:
        record = CategoryService.update(db, category_id, name)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not record:
        raise HTTPException(status_code=404, detail="Category not found")
    return record
