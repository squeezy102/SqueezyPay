"""
Smoke tests confirming BillRepository is correctly wired into BillService
and accessible through the /api/bills endpoints.

Coverage:
- POST /api/bills/ then GET /api/bills/{id}     - data round-trips through repository
- POST then DELETE then GET /                   - deletion confirmed, bill gone from list
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
    assert data["notes"] == "Cable/internet"


def test_bill_repository_delete(client):
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    bill_id = created["id"]

    delete_response = client.delete(f"/api/bills/{bill_id}")
    assert delete_response.status_code == 204

    # Bill should be gone from list
    all_response = client.get("/api/bills/")
    assert all_response.status_code == 200
    all_ids = [b["id"] for b in all_response.json()]
    assert bill_id not in all_ids

    # Direct GET should 404
    assert client.get(f"/api/bills/{bill_id}").status_code == 404
