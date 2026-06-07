"""
Tests for the /api/payment-methods endpoints.

Coverage:
- GET /api/payment-methods/              - list (empty)
- GET /api/payment-methods/{id}          - get single
- GET /api/payment-methods/{id} (404)    - not found
- POST /api/payment-methods/             - create
- POST with invalid last_four            - 422
- POST with blank nickname               - 422
- PUT /api/payment-methods/{id}          - update
- PUT /api/payment-methods/{id} (404)    - not found
- DELETE /api/payment-methods/{id}       - delete
- DELETE /api/payment-methods/{id} (404) - not found
- Expiration date is optional
- Notes are optional
"""

import pytest

BASE_PAYLOAD = {
    "nickname": "Joint Checking",
    "payment_type": "bank_account",
    "last_four": "4242",
    "expiration_date": None,
    "notes": None,
}

CARD_PAYLOAD = {
    "nickname": "Visa Rewards",
    "payment_type": "credit_card",
    "last_four": "1234",
    "expiration_date": "12/27",
    "notes": "Primary card",
}


@pytest.fixture()
def payment_method(client):
    resp = client.post("/api/payment-methods/", json=BASE_PAYLOAD)
    assert resp.status_code == 201
    return resp.json()


def test_list_empty(client):
    resp = client.get("/api/payment-methods/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_bank_account(client):
    resp = client.post("/api/payment-methods/", json=BASE_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["nickname"] == "Joint Checking"
    assert data["payment_type"] == "bank_account"
    assert data["last_four"] == "4242"
    assert data["expiration_date"] is None
    assert "id" in data


def test_create_credit_card(client):
    resp = client.post("/api/payment-methods/", json=CARD_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["nickname"] == "Visa Rewards"
    assert data["last_four"] == "1234"
    assert data["expiration_date"] == "12/27"


def test_create_invalid_last_four_letters(client):
    resp = client.post("/api/payment-methods/", json={**BASE_PAYLOAD, "last_four": "abcd"})
    assert resp.status_code == 422


def test_create_invalid_last_four_too_short(client):
    resp = client.post("/api/payment-methods/", json={**BASE_PAYLOAD, "last_four": "12"})
    assert resp.status_code == 422


def test_create_invalid_last_four_too_long(client):
    resp = client.post("/api/payment-methods/", json={**BASE_PAYLOAD, "last_four": "12345"})
    assert resp.status_code == 422


def test_create_blank_nickname(client):
    resp = client.post("/api/payment-methods/", json={**BASE_PAYLOAD, "nickname": "  "})
    assert resp.status_code == 422


def test_get_by_id(client, payment_method):
    resp = client.get(f"/api/payment-methods/{payment_method['id']}")
    assert resp.status_code == 200
    assert resp.json()["nickname"] == "Joint Checking"


def test_get_not_found(client):
    resp = client.get("/api/payment-methods/9999")
    assert resp.status_code == 404


def test_list_multiple(client):
    client.post("/api/payment-methods/", json=BASE_PAYLOAD)
    client.post("/api/payment-methods/", json=CARD_PAYLOAD)
    resp = client.get("/api/payment-methods/")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_nickname(client, payment_method):
    resp = client.put(f"/api/payment-methods/{payment_method['id']}", json={
        "nickname": "Updated Checking",
    })
    assert resp.status_code == 200
    assert resp.json()["nickname"] == "Updated Checking"


def test_update_last_four_invalid(client, payment_method):
    resp = client.put(f"/api/payment-methods/{payment_method['id']}", json={
        "last_four": "abc",
    })
    assert resp.status_code == 422


def test_update_not_found(client):
    resp = client.put("/api/payment-methods/9999", json={"nickname": "x"})
    assert resp.status_code == 404


def test_delete(client, payment_method):
    resp = client.delete(f"/api/payment-methods/{payment_method['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/payment-methods/{payment_method['id']}").status_code == 404


def test_delete_not_found(client):
    resp = client.delete("/api/payment-methods/9999")
    assert resp.status_code == 404
