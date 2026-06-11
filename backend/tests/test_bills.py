"""
Tests for the /api/bills endpoints.

Coverage:
- GET /api/bills/                     - list bills
- GET /api/bills/{id}                 - get single bill
- GET /api/bills/{id} (not found)     - 404 path
- POST /api/bills/                    - create bill
- PUT /api/bills/{id}                 - update bill
- PUT /api/bills/{id} (not found)     - 404 path
- DELETE /api/bills/{id}              - hard delete bill
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
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Example Electric Co"
    assert data["category"] == "Utilities"
    assert data["expected_amount"] == 120.00
    assert data["day_of_month"] == 20
    assert data["recurring"] is True
    assert data["notes"] == "Electric bill"
    assert "id" in data


def test_list_bills(client):
    client.post("/api/bills/", json=BILL_PAYLOAD)
    client.post("/api/bills/", json={**BILL_PAYLOAD, "name": "Example Internet Co"})

    response = client.get("/api/bills/")
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
    assert response.status_code == 404


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
    assert response.status_code == 404


def test_delete_bill(client):
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.delete(f"/api/bills/{created['id']}")
    assert response.status_code == 204

    # Should be gone entirely
    all_bills = client.get("/api/bills/").json()
    assert all(b["id"] != created["id"] for b in all_bills)

    # GET by id should 404
    assert client.get(f"/api/bills/{created['id']}").status_code == 404


def test_delete_bill_not_found(client):
    response = client.delete("/api/bills/9999")
    assert response.status_code == 404


def test_bill_amount_optional(client):
    payload = {**BILL_PAYLOAD, "expected_amount": None}
    response = client.post("/api/bills/", json=payload)
    assert response.status_code == 201
    assert response.json()["expected_amount"] is None


# ---------------------------------------------------------------------------
# BillUpdate validator tests
# ---------------------------------------------------------------------------

def test_bill_update_blank_name_rejected(client):
    """
    Scenario: PUT /api/bills/{id} with a whitespace-only name field
    EP class: Invalid partition — name stripped to empty string fails min_length/blank check
    Expected: HTTP 422 Unprocessable Entity
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"name": "   "})
    assert response.status_code == 422


def test_bill_update_invalid_url_rejected(client):
    """
    Scenario: PUT /api/bills/{id} with an ftp:// URL that is not http/https
    EP class: Invalid partition — URL must start with http:// or https://
    Expected: HTTP 422 Unprocessable Entity
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"url": "ftp://example.com"})
    assert response.status_code == 422


def test_bill_update_day_of_month_bva_0_rejected(client):
    """
    Scenario: PUT /api/bills/{id} with day_of_month=0 (one below lower boundary)
    EP class: BVA — value 0 is just below valid range [1..31]
    Expected: HTTP 422 Unprocessable Entity
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"day_of_month": 0})
    assert response.status_code == 422


def test_bill_update_day_of_month_bva_1_accepted(client):
    """
    Scenario: PUT /api/bills/{id} with day_of_month=1 (lower boundary)
    EP class: BVA — minimum valid day_of_month value
    Expected: HTTP 200 with updated day_of_month == 1
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"day_of_month": 1})
    assert response.status_code == 200
    assert response.json()["day_of_month"] == 1


def test_bill_update_day_of_month_bva_31_accepted(client):
    """
    Scenario: PUT /api/bills/{id} with day_of_month=31 (upper boundary)
    EP class: BVA — maximum valid day_of_month value
    Expected: HTTP 200 with updated day_of_month == 31
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"day_of_month": 31})
    assert response.status_code == 200
    assert response.json()["day_of_month"] == 31


def test_bill_update_day_of_month_bva_32_rejected(client):
    """
    Scenario: PUT /api/bills/{id} with day_of_month=32 (one above upper boundary)
    EP class: BVA — value 32 is just above valid range [1..31]
    Expected: HTTP 422 Unprocessable Entity
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"day_of_month": 32})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Autofill subprocess tests
# ---------------------------------------------------------------------------

def _create_bill_with_credential(client):
    """Helper: create a bill then attach a credential; return (bill_id,)."""
    bill = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    bill_id = bill["id"]
    client.post("/api/credentials/", json={
        "bill_id": bill_id,
        "username": "testuser",
        "password": "testpass",
    })
    return bill_id


def test_autofill_success_returncode_0(client):
    """
    Scenario: Autofill where subprocess exits immediately with returncode 0
    EP class: Valid path — worker completes successfully within timeout
    Expected: response body {"filled": True}
    """
    from unittest.mock import MagicMock, patch

    bill_id = _create_bill_with_credential(client)

    mock_proc = MagicMock()
    mock_proc.wait.return_value = None
    mock_proc.returncode = 0

    # subprocess is imported locally inside _try_autofill so we patch the stdlib module directly
    with patch("subprocess.Popen", return_value=mock_proc):
        response = client.post(f"/api/bills/{bill_id}/autofill")

    assert response.status_code == 200
    assert response.json() == {"filled": True}


def test_autofill_worker_still_running_timeout(client):
    """
    Scenario: Autofill where subprocess is still running when timeout expires
    EP class: Valid path — TimeoutExpired means browser is open with fields filled
    Expected: response body {"filled": True}
    """
    import subprocess
    from unittest.mock import MagicMock, patch

    bill_id = _create_bill_with_credential(client)

    mock_proc = MagicMock()
    mock_proc.wait.side_effect = subprocess.TimeoutExpired("cmd", 12)

    with patch("subprocess.Popen", return_value=mock_proc):
        response = client.post(f"/api/bills/{bill_id}/autofill")

    assert response.status_code == 200
    assert response.json() == {"filled": True}


def test_autofill_worker_fails_nonzero(client):
    """
    Scenario: Autofill where subprocess exits with non-zero returncode
    EP class: Invalid path — worker reports failure
    Expected: response body {"filled": False}
    """
    from unittest.mock import MagicMock, patch

    bill_id = _create_bill_with_credential(client)

    mock_proc = MagicMock()
    mock_proc.wait.return_value = None
    mock_proc.returncode = 1
    mock_proc.stderr.read.return_value = b"error"

    with patch("subprocess.Popen", return_value=mock_proc):
        response = client.post(f"/api/bills/{bill_id}/autofill")

    assert response.status_code == 200
    assert response.json() == {"filled": False}


def test_autofill_popen_exception(client):
    """
    Scenario: Autofill where Popen itself raises an OSError (e.g. python not found)
    EP class: Exception path — Popen raises before process starts
    Expected: response body {"filled": False}
    """
    from unittest.mock import patch

    bill_id = _create_bill_with_credential(client)

    with patch("subprocess.Popen", side_effect=OSError("not found")):
        response = client.post(f"/api/bills/{bill_id}/autofill")

    assert response.status_code == 200
    assert response.json() == {"filled": False}
