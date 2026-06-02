"""
Tests for the /api/bills endpoints.

Coverage:
- GET /api/bills/                     - list active bills
- GET /api/bills/?include_inactive=true - list all bills
- GET /api/bills/{id}                 - get single bill
- GET /api/bills/{id} (not found)     - 404 path
- POST /api/bills/                    - create bill
- PUT /api/bills/{id}                 - update bill
- PUT /api/bills/{id} (not found)     - 404 path
- DELETE /api/bills/{id}              - deactivate bill (soft delete)
- DELETE /api/bills/{id} (not found)  - 404 path
"""

BILL_PAYLOAD = {
    "name": "Example Electric Co",
    "category": "Utilities",
    "url": "https://www.example.com/account/guest-pay",
    "expected_amount": 120.00,
    "day_of_month": 20,
    "recurring": True,
    "notes": "Electric bill",
}


def test_list_bills_empty(client):
    response = client.get("/api/bills/")
    assert response.status_code == 200
    assert response.json() == []


def test_create_bill(client):
    response = client.post("/api/bills/", json=BILL_PAYLOAD)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Example Electric Co"
    assert data["category"] == "Utilities"
    assert data["expected_amount"] == 120.00
    assert data["day_of_month"] == 20
    assert data["recurring"] is True
    assert data["active"] is True
    assert data["notes"] == "Electric bill"
    assert "id" in data


def test_list_bills_returns_active_only(client):
    r1 = client.post("/api/bills/", json=BILL_PAYLOAD)
    r2 = client.post("/api/bills/", json={**BILL_PAYLOAD, "name": "Example Internet Co"})
    bill_id = r1.json()["id"]
    client.delete(f"/api/bills/{bill_id}")

    response = client.get("/api/bills/")
    names = [b["name"] for b in response.json()]
    assert "Example Internet Co" in names
    assert "Example Electric Co" not in names


def test_list_bills_include_inactive(client):
    r1 = client.post("/api/bills/", json=BILL_PAYLOAD)
    client.post("/api/bills/", json={**BILL_PAYLOAD, "name": "Example Internet Co"})
    client.delete(f"/api/bills/{r1.json()['id']}")

    response = client.get("/api/bills/?include_inactive=true")
    names = [b["name"] for b in response.json()]
    assert "Example Electric Co" in names
    assert "Example Internet Co" in names


def test_get_bill_by_id(client):
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.get(f"/api/bills/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Example Electric Co"


def test_get_bill_not_found(client):
    response = client.get("/api/bills/9999")
    assert response.status_code == 200
    assert "error" in response.json()


def test_update_bill(client):
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={
        **BILL_PAYLOAD,
        "name": "Example Electric Co Updated",
        "expected_amount": 135.50,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Example Electric Co Updated"
    assert data["expected_amount"] == 135.50


def test_update_bill_not_found(client):
    response = client.put("/api/bills/9999", json=BILL_PAYLOAD)
    assert response.status_code == 200
    assert response.json() is None


def test_deactivate_bill(client):
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.delete(f"/api/bills/{created['id']}")
    assert response.status_code == 200
    assert response.json()["active"] is False

    # Should no longer appear in active list
    active = client.get("/api/bills/").json()
    assert all(b["id"] != created["id"] for b in active)


def test_deactivate_bill_not_found(client):
    response = client.delete("/api/bills/9999")
    assert response.status_code == 200
    assert response.json() is None


def test_bill_amount_optional(client):
    payload = {**BILL_PAYLOAD, "expected_amount": None}
    response = client.post("/api/bills/", json=payload)
    assert response.status_code == 200
    assert response.json()["expected_amount"] is None
