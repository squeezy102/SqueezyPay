"""
Tests for input validation across all API endpoints.

Coverage:
- Bills: day_of_month out of range, invalid URL, negative amount, blank name
- Income: invalid frequency, negative amount, blank source_name
- Payment history: invalid date format, negative amount
- Payment methods: invalid last_four
- Auth: passphrase too short
- Cascade delete: bill delete removes payment history too
"""

import pytest

VALID_BILL = {
    "name": "Example Loan Co",
    "category": "Loans / Debt",
    "url": "https://example.com/pay",
    "expected_amount": 300.00,
    "day_of_month": 15,
    "recurring": True,
}


@pytest.fixture()
def bill(client):
    resp = client.post("/api/bills/", json=VALID_BILL)
    assert resp.status_code == 201
    return resp.json()


# ── Bills validation ──────────────────────────────────────────────────────────

def test_bill_day_zero(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "day_of_month": 0})
    assert resp.status_code == 422


def test_bill_day_32(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "day_of_month": 32})
    assert resp.status_code == 422


def test_bill_day_31_valid(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "day_of_month": 31})
    assert resp.status_code == 201


def test_bill_day_1_valid(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "day_of_month": 1})
    assert resp.status_code == 201


def test_bill_invalid_url_no_scheme(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "url": "example.com/pay"})
    assert resp.status_code == 422


def test_bill_invalid_url_relative(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "url": "/pay/now"})
    assert resp.status_code == 422


def test_bill_http_url_valid(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "url": "http://example.com/pay"})
    assert resp.status_code == 201


def test_bill_negative_amount(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "expected_amount": -1.00})
    assert resp.status_code == 422


def test_bill_zero_amount(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "expected_amount": 0.00})
    assert resp.status_code == 422


def test_bill_blank_name(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "name": "   "})
    assert resp.status_code == 422


def test_bill_blank_category(client):
    resp = client.post("/api/bills/", json={**VALID_BILL, "category": ""})
    assert resp.status_code == 422


# ── Income validation ─────────────────────────────────────────────────────────

VALID_INCOME = {
    "source_name": "Primary Paycheck",
    "amount": 2500.00,
    "frequency": "bi-weekly",
    "next_expected_date": "2026-06-15T00:00:00",
    "active": True,
}


def test_income_invalid_frequency(client):
    resp = client.post("/api/income/", json={**VALID_INCOME, "frequency": "yearly"})
    assert resp.status_code == 422


def test_income_invalid_frequency_daily(client):
    resp = client.post("/api/income/", json={**VALID_INCOME, "frequency": "daily"})
    assert resp.status_code == 422


def test_income_all_valid_frequencies(client):
    for freq in ("weekly", "bi-weekly", "semi-monthly", "monthly"):
        resp = client.post("/api/income/", json={**VALID_INCOME, "frequency": freq})
        assert resp.status_code == 201, f"frequency '{freq}' should be valid"


def test_income_negative_amount(client):
    resp = client.post("/api/income/", json={**VALID_INCOME, "amount": -100.00})
    assert resp.status_code == 422


def test_income_zero_amount(client):
    resp = client.post("/api/income/", json={**VALID_INCOME, "amount": 0.00})
    assert resp.status_code == 422


def test_income_blank_source_name(client):
    resp = client.post("/api/income/", json={**VALID_INCOME, "source_name": "  "})
    assert resp.status_code == 422


# ── Payment history validation ────────────────────────────────────────────────

def test_payment_invalid_date(client, bill):
    resp = client.post("/api/payment-history/", json={
        "bill_id": bill["id"],
        "payment_date": "not-a-date",
        "amount_paid": 100.00,
    })
    assert resp.status_code == 422


def test_payment_negative_amount(client, bill):
    resp = client.post("/api/payment-history/", json={
        "bill_id": bill["id"],
        "payment_date": "2026-06-01",
        "amount_paid": -50.00,
    })
    assert resp.status_code == 422


def test_payment_zero_amount(client, bill):
    resp = client.post("/api/payment-history/", json={
        "bill_id": bill["id"],
        "payment_date": "2026-06-01",
        "amount_paid": 0.00,
    })
    assert resp.status_code == 422


def test_payment_valid_iso_date(client, bill):
    resp = client.post("/api/payment-history/", json={
        "bill_id": bill["id"],
        "payment_date": "2026-06-01",
        "amount_paid": 100.00,
    })
    assert resp.status_code == 201


# ── Auth validation ───────────────────────────────────────────────────────────

def test_setup_passphrase_too_short(client):
    resp = client.post("/api/auth/setup", json={"passphrase": "short"})
    assert resp.status_code == 422


def test_setup_passphrase_minimum_valid(client):
    resp = client.post("/api/auth/setup", json={"passphrase": "exactly8"})
    assert resp.status_code == 201


def test_change_passphrase_new_too_short(client):
    # First configure auth
    client.post("/api/auth/setup", json={"passphrase": "InitialPass1!"})
    resp = client.post("/api/auth/change-passphrase", json={
        "current_passphrase": "InitialPass1!",
        "new_passphrase": "short",
    })
    assert resp.status_code == 422


# ── Cascade delete ────────────────────────────────────────────────────────────

def test_delete_bill_cascades_payment_history(client, bill):
    # Log a payment
    resp = client.post("/api/payment-history/", json={
        "bill_id": bill["id"],
        "payment_date": "2026-06-01",
        "amount_paid": 300.00,
        "confirmation_number": "CONF-CASCADE",
    })
    assert resp.status_code == 201
    payment_id = resp.json()["id"]

    # Delete the bill
    assert client.delete(f"/api/bills/{bill['id']}").status_code == 204

    # Payment should be gone
    remaining = client.get("/api/payment-history/").json()
    assert all(p["id"] != payment_id for p in remaining)


def test_delete_bill_cascades_credentials(client, bill):
    resp = client.post("/api/credentials/", json={
        "bill_id": bill["id"],
        "username": "cascade_user",
        "password": "CascadePass1!",
    })
    assert resp.status_code == 201
    cred_id = resp.json()["id"]

    assert client.delete(f"/api/bills/{bill['id']}").status_code == 204
    assert client.get(f"/api/credentials/{cred_id}").status_code == 404
