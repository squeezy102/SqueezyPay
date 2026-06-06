from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from database.db import get_db
from services.bill_service import BillService
from services.credential_service import CredentialService
from core.logging_config import get_logger

logger = get_logger("squeezypay.api.bills")

router = APIRouter(prefix="/api/bills", tags=["bills"])


class BillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    expected_amount: float | None = Field(None, gt=0)
    day_of_month: int = Field(..., ge=1, le=31)
    url: str = Field(..., min_length=1, max_length=500)
    recurring: bool = True
    notes: str | None = None

    @field_validator("name", "category", "url")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field cannot be blank")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class BillUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = Field(None, min_length=1, max_length=100)
    expected_amount: float | None = Field(None, gt=0)
    day_of_month: int | None = Field(None, ge=1, le=31)
    url: str | None = Field(None, min_length=1, max_length=500)
    recurring: bool | None = None
    notes: str | None = None

    @field_validator("name", "category", "url")
    @classmethod
    def strip_and_require(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("field cannot be blank")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


@router.get("/")
def get_bills(db: Session = Depends(get_db)):
    return BillService.get_all_bills(db)


@router.get("/{bill_id}")
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = BillService.get_bill(db, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@router.post("/", status_code=201)
def create_bill(payload: BillCreate, db: Session = Depends(get_db)):
    return BillService.create_bill(db, payload.model_dump())


@router.put("/{bill_id}")
def update_bill(bill_id: int, payload: BillUpdate, db: Session = Depends(get_db)):
    result = BillService.update_bill(db, bill_id, payload.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Bill not found")
    return result


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    if not BillService.delete_bill(db, bill_id):
        raise HTTPException(status_code=404, detail="Bill not found")


@router.post("/{bill_id}/autofill")
def autofill_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = BillService.get_bill(db, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    credential = CredentialService.get_by_bill_id(db, bill_id)
    if not credential:
        raise HTTPException(status_code=404, detail="No credential stored for this bill")

    url = bill["url"]
    username = credential["username"]
    password = credential["password"]

    filled = _try_autofill(url, username, password)
    return {"filled": filled}


def _try_autofill(url: str, username: str, password: str) -> bool:
    import base64
    import subprocess
    import sys
    from pathlib import Path

    worker = Path(__file__).parent.parent / "scripts" / "autofill_worker.py"
    python = sys.executable

    # Encode args as base64 to avoid any shell quoting issues with special characters
    args = [
        python,
        str(worker),
        base64.b64encode(url.encode()).decode(),
        base64.b64encode(username.encode()).decode(),
        base64.b64encode(password.encode()).decode(),
    ]

    try:
        # Wait briefly for the worker to attempt the fill, then detach
        proc = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        # Give it up to 10s to navigate and fill — then return regardless
        try:
            proc.wait(timeout=10)
            if proc.returncode == 0:
                logger.info(f"autofill: credentials filled for {url}")
                return True
            else:
                err = proc.stderr.read().decode(errors="replace") if proc.stderr else ""
                logger.warning(f"autofill: worker exited {proc.returncode} — {err.strip()}")
                return False
        except subprocess.TimeoutExpired:
            # Worker is still running (browser open, waiting for page close) — that's success
            logger.info(f"autofill: worker running, browser open for {url}")
            return True

    except Exception as exc:
        logger.warning(f"autofill: failed to launch worker — {exc}")
        return False
