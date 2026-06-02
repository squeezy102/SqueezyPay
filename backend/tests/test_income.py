"""
Tests for the /api/income endpoints.

Coverage:
- GET /api/income/                          - list active income (empty)
- POST /api/income/                         - create income record (201)
- GET /api/income/{id}                      - get single income record
- GET /api/income/{id} (not found)          - 404 path
- PUT /api/income/{id}                      - update income record
- PUT /api/income/{id} (not found)          - 404 path
- DELETE /api/income/{id}                   - deactivate income (204)
- DELETE /api/income/{id} (not found)       - 404 path
- POST /api/income/{id}/reactivate          - reactivate income
- GET /api/income/?include_inactive=true    - list all including inactive
- GET /api/income/monthly-total             - total with no records
- GET /api/income/monthly-total             - total calculated across frequencies
"""

INCOME_PAYLOAD = {
    "source_name": "Employer A",
    "amount": 2000.00,
    "frequency": "bi-weekly",
    "next_expected_date": "2026-07-01T00:00:00",
}


def test_get_income_empty(client):
    response = client.get("/api/income/")
    assert response.status_code == 200
    assert response.json() == []


def test_create_income(client):
    response = client.post("/api/income/", json=INCOME_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["source_name"] == "Employer A"
    assert data["amount"] == 2000.00
    assert data["frequency"] == "bi-weekly"
    assert data["active"] is True
    assert "id" in data
    assert "next_expected_date" in data


def test_get_income_by_id(client):
    created = client.post("/api/income/", json=INCOME_PAYLOAD).json()
    response = client.get(f"/api/income/{created['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == created["id"]
    assert data["source_name"] == "Employer A"


def test_get_income_by_id_not_found(client):
    response = client.get("/api/income/999")
    assert response.status_code == 404


def test_update_income(client):
    created = client.post("/api/income/", json=INCOME_PAYLOAD).json()
    response = client.put(f"/api/income/{created['id']}", json={
        **INCOME_PAYLOAD,
        "source_name": "Employer A Updated",
        "amount": 2500.00,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["source_name"] == "Employer A Updated"
    assert data["amount"] == 2500.00


def test_update_income_not_found(client):
    response = client.put("/api/income/999", json=INCOME_PAYLOAD)
    assert response.status_code == 404


def test_deactivate_income(client):
    created = client.post("/api/income/", json=INCOME_PAYLOAD).json()
    response = client.delete(f"/api/income/{created['id']}")
    assert response.status_code == 204

    # Should no longer appear in active list
    active = client.get("/api/income/").json()
    assert all(r["id"] != created["id"] for r in active)


def test_deactivate_income_not_found(client):
    response = client.delete("/api/income/999")
    assert response.status_code == 404


def test_reactivate_income(client):
    created = client.post("/api/income/", json=INCOME_PAYLOAD).json()
    client.delete(f"/api/income/{created['id']}")

    # Confirm it's gone from active list
    active_before = client.get("/api/income/").json()
    assert all(r["id"] != created["id"] for r in active_before)

    # Reactivate
    response = client.post(f"/api/income/{created['id']}/reactivate")
    assert response.status_code == 200
    data = response.json()
    assert data["active"] is True
    assert data["id"] == created["id"]

    # Confirm it's back in active list
    active_after = client.get("/api/income/").json()
    assert any(r["id"] == created["id"] for r in active_after)


def test_get_income_include_inactive(client):
    r1 = client.post("/api/income/", json=INCOME_PAYLOAD).json()
    client.post("/api/income/", json={**INCOME_PAYLOAD, "source_name": "Side Job"})
    client.delete(f"/api/income/{r1['id']}")

    # Active-only should not include deactivated record
    active = client.get("/api/income/").json()
    assert all(r["id"] != r1["id"] for r in active)

    # include_inactive=true should include it
    all_records = client.get("/api/income/?include_inactive=true").json()
    ids = [r["id"] for r in all_records]
    assert r1["id"] in ids


def test_monthly_total_empty(client):
    response = client.get("/api/income/monthly-total")
    assert response.status_code == 200
    assert response.json() == {"monthly_total": 0.0}


def test_monthly_total_calculation(client):
    # weekly $100 → $100 * 52/12 ≈ $433.33/mo
    client.post("/api/income/", json={
        "source_name": "Weekly Gig",
        "amount": 100.00,
        "frequency": "weekly",
        "next_expected_date": "2026-07-01T00:00:00",
    })
    # bi-weekly $1000 → $1000 * 26/12 ≈ $2166.67/mo
    client.post("/api/income/", json={
        "source_name": "Bi-Weekly Job",
        "amount": 1000.00,
        "frequency": "bi-weekly",
        "next_expected_date": "2026-07-01T00:00:00",
    })
    # semi-monthly $500 → $500 * 2 = $1000/mo
    client.post("/api/income/", json={
        "source_name": "Semi-Monthly Pay",
        "amount": 500.00,
        "frequency": "semi-monthly",
        "next_expected_date": "2026-07-01T00:00:00",
    })
    # monthly $200 → $200/mo
    client.post("/api/income/", json={
        "source_name": "Monthly Stipend",
        "amount": 200.00,
        "frequency": "monthly",
        "next_expected_date": "2026-07-01T00:00:00",
    })

    response = client.get("/api/income/monthly-total")
    assert response.status_code == 200
    total = response.json()["monthly_total"]

    expected = (100 * 52 / 12) + (1000 * 26 / 12) + (500 * 2) + 200
    assert abs(total - expected) < 0.01
