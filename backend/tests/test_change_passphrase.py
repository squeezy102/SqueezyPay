"""
Tests for POST /api/auth/change-passphrase (REQ-016).

The shared `client` fixture bypasses require_auth, so we call the endpoint
directly with the JSON body — no token needed in these tests.
"""
from fastapi.testclient import TestClient


def _setup(client: TestClient, passphrase: str = "OriginalPass1") -> None:
    """Helper: configure the passphrase so change-passphrase has something to work with."""
    client.post("/api/auth/setup", json={"passphrase": passphrase})


def test_change_passphrase_success(client: TestClient) -> None:
    """Correct current passphrase and a new passphrase returns 200."""
    _setup(client, "OriginalPass1")
    resp = client.post(
        "/api/auth/change-passphrase",
        json={"current_passphrase": "OriginalPass1", "new_passphrase": "NewSecurePass2"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"message": "Passphrase updated"}


def test_change_passphrase_wrong_current(client: TestClient) -> None:
    """Wrong current passphrase returns 401."""
    _setup(client, "OriginalPass1")
    resp = client.post(
        "/api/auth/change-passphrase",
        json={"current_passphrase": "WrongPass", "new_passphrase": "NewSecurePass2"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Current passphrase incorrect"


def test_change_passphrase_new_passphrase_is_active(client: TestClient) -> None:
    """After a successful change, login with the new passphrase works."""
    _setup(client, "OriginalPass1")
    client.post(
        "/api/auth/change-passphrase",
        json={"current_passphrase": "OriginalPass1", "new_passphrase": "NewSecurePass2"},
    )
    login = client.post("/api/auth/login", json={"passphrase": "NewSecurePass2"})
    assert login.status_code == 200
    assert "access_token" in login.json()


def test_change_passphrase_old_passphrase_rejected_after_change(client: TestClient) -> None:
    """After a successful change, the old passphrase no longer works."""
    _setup(client, "OriginalPass1")
    client.post(
        "/api/auth/change-passphrase",
        json={"current_passphrase": "OriginalPass1", "new_passphrase": "NewSecurePass2"},
    )
    login = client.post("/api/auth/login", json={"passphrase": "OriginalPass1"})
    assert login.status_code == 401


def test_change_passphrase_unconfigured_returns_401(client: TestClient) -> None:
    """Calling change-passphrase before setup returns 401 (no passphrase to match against)."""
    resp = client.post(
        "/api/auth/change-passphrase",
        json={"current_passphrase": "anything", "new_passphrase": "NewSecurePass2"},
    )
    assert resp.status_code == 401
