"""
Smoke tests confirming BillRepository is correctly wired into BillService
and accessible through the /api/bills endpoints.

Coverage:
- POST /api/bills/ then GET /api/bills/{id}          - data round-trips through repository
- POST then DELETE then GET / vs GET /?include_inactive=true - deactivation visible correctly
"""

BILL_PAYLOAD = {
    "name": "Spectrum",
    "category": "Internet",
    "url": "https://www.spectrum.net/pay-bill",
    "expected_amount": 79.99,
    "day_of_month": 15,
    "recurring": True,
    "notes": "Cable/internet",
}


def test_bill_repository_create_and_retrieve(client):
    create_response = client.post("/api/bills/", json=BILL_PAYLOAD)
    assert create_response.status_code == 201
    created = create_response.json()

    get_response = client.get(f"/api/bills/{created['id']}")
    assert get_response.status_code == 200
    data = get_response.json()

    assert data["id"] == created["id"]
    assert data["name"] == "Spectrum"
    assert data["category"] == "Internet"
    assert data["expected_amount"] == 79.99
    assert data["day_of_month"] == 15
    assert data["recurring"] is True
    assert data["active"] is True
    assert data["notes"] == "Cable/internet"


def test_bill_repository_deactivate(client):
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    bill_id = created["id"]

    # Deactivate the bill
    delete_response = client.delete(f"/api/bills/{bill_id}")
    assert delete_response.status_code == 204

    # Active-only list should NOT include the deactivated bill
    active_response = client.get("/api/bills/")
    assert active_response.status_code == 200
    active_ids = [b["id"] for b in active_response.json()]
    assert bill_id not in active_ids

    # include_inactive=true SHOULD include the deactivated bill
    all_response = client.get("/api/bills/?include_inactive=true")
    assert all_response.status_code == 200
    all_ids = [b["id"] for b in all_response.json()]
    assert bill_id in all_ids
