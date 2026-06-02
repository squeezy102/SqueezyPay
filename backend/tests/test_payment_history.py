"""
Tests for the /api/payment-history endpoints.

Coverage:
- GET /api/payment-history/              - list all payments (empty)
- GET /api/payment-history/              - list all payments (with data)
- GET /api/payment-history/bill/{id}     - payments for a specific bill
- GET /api/payment-history/bill/{id}     - unknown bill returns empty list
- POST /api/payment-history/             - log a payment
- POST /api/payment-history/             - log fails for unknown bill (404)
- POST /api/payment-history/             - optional fields default to null
- DELETE /api/payment-history/{id}       - delete a payment record
- DELETE /api/payment-history/{id}       - not found returns 404
"""

import pytest

BILL_PAYLOAD = {
    "name": "Example Student Loan Co",
    "category": "Education",
    "url": "https://example.com/welcome",
    "expected_amount": 250.00,
    "day_of_month": 5,
    "recurring": True,
    "notes": None,
}

PAYMENT_PAYLOAD = {
    "payment_date": "2026-05-05T00:00:00",
    "amount_paid": 250.00,
    "payment_method": "ECU Checking",
    "confirmation_number": "CONF123456",
    "notes": "May payment",
}


@pytest.fixture()
def bill(client):
    response = client.post("/api/bills/", json=BILL_PAYLOAD)
    assert response.status_code == 200
    return response.json()


def test_list_payments_empty(client):
    response = client.get("/api/payment-history/")
    assert response.status_code == 200
    assert response.json() == []


def test_log_payment(client, bill):
    response = client.post("/api/payment-history/", json={**PAYMENT_PAYLOAD, "bill_id": bill["id"]})
    assert response.status_code == 201
    data = response.json()
    assert data["bill_id"] == bill["id"]
    assert data["bill_name"] == "Example Student Loan Co"
    assert data["amount_paid"] == 250.00
    assert data["confirmation_number"] == "CONF123456"
    assert data["payment_method"] == "ECU Checking"
    assert data["notes"] == "May payment"
    assert "id" in data


def test_log_payment_unknown_bill(client):
    response = client.post("/api/payment-history/", json={**PAYMENT_PAYLOAD, "bill_id": 9999})
    assert response.status_code == 404


def test_log_payment_optional_fields_null(client, bill):
    payload = {
        "bill_id": bill["id"],
        "payment_date": "2026-05-05T00:00:00",
        "amount_paid": 200.00,
    }
    response = client.post("/api/payment-history/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["confirmation_number"] is None
    assert data["payment_method"] is None
    assert data["notes"] is None


def test_list_all_payments(client, bill):
    client.post("/api/payment-history/", json={**PAYMENT_PAYLOAD, "bill_id": bill["id"]})
    client.post("/api/payment-history/", json={**PAYMENT_PAYLOAD, "bill_id": bill["id"], "confirmation_number": "CONF999"})

    response = client.get("/api/payment-history/")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_payments_by_bill(client, bill):
    client.post("/api/payment-history/", json={**PAYMENT_PAYLOAD, "bill_id": bill["id"]})

    response = client.get(f"/api/payment-history/bill/{bill['id']}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["bill_id"] == bill["id"]


def test_get_payments_by_unknown_bill(client):
    response = client.get("/api/payment-history/bill/9999")
    assert response.status_code == 200
    assert response.json() == []


def test_delete_payment(client, bill):
    created = client.post("/api/payment-history/", json={**PAYMENT_PAYLOAD, "bill_id": bill["id"]}).json()

    response = client.delete(f"/api/payment-history/{created['id']}")
    assert response.status_code == 204

    remaining = client.get("/api/payment-history/").json()
    assert all(p["id"] != created["id"] for p in remaining)


def test_delete_payment_not_found(client):
    response = client.delete("/api/payment-history/9999")
    assert response.status_code == 404
