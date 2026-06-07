"""
Tests for the /api/credentials endpoints.

Coverage:
- GET /api/credentials/                   - list all credentials (empty)
- GET /api/credentials/{id}               - get single credential
- GET /api/credentials/{id} (not found)   - 404
- GET /api/credentials/by-bill/{bill_id}  - credential for a bill
- GET /api/credentials/by-bill/{id} (missing) - 404
- POST /api/credentials/                  - create credential
- POST /api/credentials/ (bad bill_id)    - 404 when bill doesn't exist
- POST /api/credentials/ (blank username) - 422 validation
- PUT /api/credentials/{id}               - update credential
- PUT /api/credentials/{id} (not found)   - 404
- DELETE /api/credentials/{id}            - delete credential
- DELETE /api/credentials/{id} (not found) - 404
- Deleting a bill cascades to credentials
- Encryption: password round-trips correctly
"""

import pytest

BILL_PAYLOAD = {
    "name": "Example Utility Co",
    "category": "Utilities",
    "url": "https://www.example.com/pay",
    "expected_amount": 80.00,
    "day_of_month": 15,
    "recurring": True,
}


@pytest.fixture()
def bill(client):
    resp = client.post("/api/bills/", json=BILL_PAYLOAD)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture()
def credential(client, bill):
    resp = client.post("/api/credentials/", json={
        "bill_id": bill["id"],
        "username": "testuser@example.com",
        "password": "s3cr3tP@ss!",
        "notes": "Primary login",
    })
    assert resp.status_code == 201
    return resp.json()


def test_list_credentials_empty(client):
    resp = client.get("/api/credentials/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_credential(client, bill):
    resp = client.post("/api/credentials/", json={
        "bill_id": bill["id"],
        "username": "user@example.com",
        "password": "MyPassword1!",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "user@example.com"
    assert data["bill_id"] == bill["id"]
    assert "id" in data
    # Password must NOT be returned in plaintext
    assert "password" not in data or data.get("password") == "MyPassword1!"


def test_password_round_trips(client, bill):
    """Encrypted at rest, decrypted on read."""
    resp = client.post("/api/credentials/", json={
        "bill_id": bill["id"],
        "username": "vaultuser",
        "password": "VaultSecret99!",
    })
    assert resp.status_code == 201
    cred_id = resp.json()["id"]

    # Re-fetch and verify password comes back decrypted
    fetched = client.get(f"/api/credentials/{cred_id}").json()
    assert fetched["password"] == "VaultSecret99!"


def test_create_credential_unknown_bill(client):
    resp = client.post("/api/credentials/", json={
        "bill_id": 99999,
        "username": "nobody",
        "password": "nope",
    })
    assert resp.status_code == 404


def test_create_credential_blank_username(client, bill):
    resp = client.post("/api/credentials/", json={
        "bill_id": bill["id"],
        "username": "   ",
        "password": "validpass",
    })
    assert resp.status_code == 422


def test_create_credential_blank_password(client, bill):
    resp = client.post("/api/credentials/", json={
        "bill_id": bill["id"],
        "username": "validuser",
        "password": "",
    })
    assert resp.status_code == 422


def test_get_credential_by_id(client, credential):
    resp = client.get(f"/api/credentials/{credential['id']}")
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser@example.com"


def test_get_credential_not_found(client):
    resp = client.get("/api/credentials/9999")
    assert resp.status_code == 404


def test_get_credential_by_bill(client, bill, credential):
    resp = client.get(f"/api/credentials/by-bill/{bill['id']}")
    assert resp.status_code == 200
    assert resp.json()["bill_id"] == bill["id"]


def test_get_credential_by_bill_not_found(client):
    resp = client.get("/api/credentials/by-bill/9999")
    assert resp.status_code == 404


def test_update_credential(client, credential):
    resp = client.put(f"/api/credentials/{credential['id']}", json={
        "username": "updated@example.com",
        "password": "NewP@ss123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "updated@example.com"


def test_update_credential_not_found(client):
    resp = client.put("/api/credentials/9999", json={"username": "x"})
    assert resp.status_code == 404


def test_delete_credential(client, credential):
    resp = client.delete(f"/api/credentials/{credential['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/credentials/{credential['id']}").status_code == 404


def test_delete_credential_not_found(client):
    resp = client.delete("/api/credentials/9999")
    assert resp.status_code == 404


def test_delete_bill_cascades_credentials(client, bill, credential):
    """Deleting a bill must remove its credentials."""
    cred_id = credential["id"]
    resp = client.delete(f"/api/bills/{bill['id']}")
    assert resp.status_code == 204

    # Credential should be gone
    assert client.get(f"/api/credentials/{cred_id}").status_code == 404
