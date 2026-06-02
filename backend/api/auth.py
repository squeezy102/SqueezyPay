from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from database.db import get_db
from services.auth_service import AuthService

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/auth", tags=["auth"])


class PassphraseRequest(BaseModel):
    passphrase: str


class ChangePassphraseRequest(BaseModel):
    current_passphrase: str
    new_passphrase: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    svc = AuthService(db)
    return {"configured": svc.is_configured()}


@router.post("/setup", status_code=status.HTTP_201_CREATED)
def setup(body: PassphraseRequest, db: Session = Depends(get_db)):
    svc = AuthService(db)
    if not svc.setup(body.passphrase):
        raise HTTPException(status_code=409, detail="Passphrase already configured")
    token = svc.create_token()
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: PassphraseRequest, db: Session = Depends(get_db)):
    svc = AuthService(db)
    if not svc.verify(body.passphrase):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect passphrase")
    token = svc.create_token()
    return TokenResponse(access_token=token)


@router.post("/logout")
def logout():
    return {"message": "Logged out"}


@router.post("/change-passphrase")
def change_passphrase(body: ChangePassphraseRequest, db: Session = Depends(get_db)):
    svc = AuthService(db)
    if not svc.change_passphrase(body.current_passphrase, body.new_passphrase):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current passphrase incorrect")
    return {"message": "Passphrase updated"}
