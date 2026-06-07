from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.db import get_db
from services.plaid_service import PlaidService

router = APIRouter(prefix="/api/plaid", tags=["plaid"])


# ── Request models ────────────────────────────────────────────────────────────

class ExchangeTokenRequest(BaseModel):
    public_token: str = Field(..., min_length=1)


class SyncBalancesRequest(BaseModel):
    plaid_item_id: int = Field(..., gt=0)


class SyncTransactionsRequest(BaseModel):
    plaid_item_id: int = Field(..., gt=0)
    days_back: int = Field(30, ge=1, le=365)


class AssignCategoryRequest(BaseModel):
    category_id: int = Field(..., gt=0)


# ── Link flow ─────────────────────────────────────────────────────────────────

@router.post("/link-token")
def create_link_token():
    try:
        token = PlaidService.create_link_token()
        return {"link_token": token}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Plaid error: {exc}")


@router.post("/exchange-token", status_code=201)
def exchange_token(payload: ExchangeTokenRequest, db: Session = Depends(get_db)):
    try:
        return PlaidService.exchange_public_token(db, payload.public_token)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Plaid error: {exc}")


# ── Items ─────────────────────────────────────────────────────────────────────

@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    return PlaidService.get_all_items(db)


@router.delete("/items/{item_id}", status_code=204)
def disconnect_item(item_id: int, db: Session = Depends(get_db)):
    try:
        deleted = PlaidService.disconnect_item(db, item_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Plaid error: {exc}")
    if not deleted:
        raise HTTPException(status_code=404, detail="Plaid item not found")


# ── Accounts ──────────────────────────────────────────────────────────────────

@router.get("/accounts")
def get_accounts(db: Session = Depends(get_db)):
    return PlaidService.get_accounts(db)


@router.post("/accounts/sync-balances")
def sync_balances(payload: SyncBalancesRequest, db: Session = Depends(get_db)):
    try:
        return PlaidService.sync_balances(db, payload.plaid_item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Plaid error: {exc}")


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/transactions")
def get_transactions(
    account_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return PlaidService.get_transactions(
        db,
        plaid_account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        limit=min(limit, 200),
        offset=offset,
    )


@router.post("/transactions/sync")
def sync_transactions(payload: SyncTransactionsRequest, db: Session = Depends(get_db)):
    try:
        return PlaidService.sync_transactions(db, payload.plaid_item_id, payload.days_back)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Plaid error: {exc}")


@router.put("/transactions/{tx_id}/category")
def assign_category(tx_id: int, payload: AssignCategoryRequest, db: Session = Depends(get_db)):
    result = PlaidService.assign_category(db, tx_id, payload.category_id)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result


# ── Blame graph ───────────────────────────────────────────────────────────────

@router.get("/blame")
def get_blame(days_back: int = 30, db: Session = Depends(get_db)):
    return PlaidService.get_blame_data(db, days_back=days_back)
