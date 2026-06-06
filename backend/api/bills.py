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
    # Selectors tried in order for the username/email field
    USERNAME_SELECTORS = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[name="user"]',
        'input[name="login"]',
        'input[id*="email" i]',
        'input[id*="user" i]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
    ]
    PASSWORD_SELECTORS = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id*="password" i]',
        'input[autocomplete="current-password"]',
    ]

    try:
        from playwright.sync_api import Playwright, sync_playwright, TimeoutError as PWTimeout

        # Start playwright without a context manager so the browser outlives this function
        pw: Playwright = sync_playwright().start()
        browser = pw.chromium.launch(headless=False)
        page = browser.new_page()

        try:
            page.goto(url, timeout=15000, wait_until="domcontentloaded")
        except PWTimeout:
            logger.warning(f"autofill: page load timed out for {url}")
            browser.close()
            pw.stop()
            return False

        # Locate username field — first visible match wins
        username_field = None
        for sel in USERNAME_SELECTORS:
            try:
                el = page.locator(sel).first
                if el.count() > 0 and el.is_visible():
                    username_field = el
                    break
            except Exception:
                continue

        if username_field is None:
            logger.info(f"autofill: no username field found at {url}")
            browser.close()
            pw.stop()
            return False

        # Locate password field — first visible match wins
        password_field = None
        for sel in PASSWORD_SELECTORS:
            try:
                el = page.locator(sel).first
                if el.count() > 0 and el.is_visible():
                    password_field = el
                    break
            except Exception:
                continue

        if password_field is None:
            logger.info(f"autofill: no password field found at {url}")
            browser.close()
            pw.stop()
            return False

        username_field.fill(username)
        password_field.fill(password)

        # Verify values were accepted
        filled_user = username_field.input_value()
        filled_pass  = password_field.input_value()
        if filled_user != username or filled_pass != password:
            logger.warning("autofill: field fill verification failed")
            browser.close()
            pw.stop()
            return False

        logger.info(f"autofill: credentials filled for bill_id tied to {url}")
        # Browser stays open — user completes login and closes it themselves
        return True

    except Exception as exc:
        logger.warning(f"autofill: unexpected error — {exc}")
        return False
