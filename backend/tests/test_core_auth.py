"""
Direct unit tests for the require_auth FastAPI dependency.

These tests call require_auth() directly — they deliberately do NOT go through
the HTTP layer. The conftest.py fixture overrides require_auth to a no-op for
all other tests, which means the JWT validation logic would otherwise have 0%
decision coverage. This file is the dedicated coverage for that boundary.

Standards: ISTQB EP (Equivalence Partitioning), BVA (Boundary Value Analysis),
MC/DC on the five decision branches of require_auth().
"""
import datetime

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from core.auth import ALGORITHM, require_auth

_SECRET = "test-secret-key-for-auth-tests-32chars!!"


def _credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _valid_token(secret: str = _SECRET) -> str:
    payload = {
        "sub": "household",
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def _expired_token(secret: str = _SECRET) -> str:
    payload = {
        "sub": "household",
        "exp": datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# EP class 1: no credentials at all (Authorization header absent)
# ---------------------------------------------------------------------------

def test_require_auth_no_credentials_raises_401():
    """
    EP class: credentials object is None (HTTPBearer auto_error=False returns
    None when no Authorization header is present).
    Expected: 401 'Not authenticated'.
    """
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=None)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Not authenticated"


# ---------------------------------------------------------------------------
# EP class 2: credentials present but SQUEEZYPAY_SECRET_KEY is absent
# ---------------------------------------------------------------------------

def test_require_auth_empty_secret_raises_401(monkeypatch):
    """
    EP class: Bearer token provided, but SQUEEZYPAY_SECRET_KEY env var is
    empty string (boundary: empty == missing).
    Expected: 401 'Authentication unavailable'.

    BVA note: both '' (empty) and unset must be rejected; this covers the
    empty-string boundary. The 'not secret' guard catches both.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "")
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=_credentials("any.token.value"))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Authentication unavailable"


def test_require_auth_missing_secret_raises_401(monkeypatch):
    """
    EP class: SQUEEZYPAY_SECRET_KEY env var is completely absent (not just empty).
    Expected: 401 'Authentication unavailable'.
    """
    monkeypatch.delenv("SQUEEZYPAY_SECRET_KEY", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=_credentials("any.token.value"))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Authentication unavailable"


# ---------------------------------------------------------------------------
# EP class 3: valid token, correct secret
# ---------------------------------------------------------------------------

def test_require_auth_valid_token_returns_none(monkeypatch):
    """
    EP class: well-formed, non-expired JWT signed with the correct secret.
    Expected: require_auth returns without raising (FastAPI dependency returns None).

    This is the only 'success' equivalence class. All other classes are failure
    partitions tested above and below.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", _SECRET)
    result = require_auth(credentials=_credentials(_valid_token()))
    assert result is None


# ---------------------------------------------------------------------------
# EP class 4: expired token
# ---------------------------------------------------------------------------

def test_require_auth_expired_token_raises_401(monkeypatch):
    """
    EP class: JWT is structurally valid and correctly signed, but the exp
    claim is in the past.
    Expected: 401 'Session expired' — NOT 'Invalid token'.

    MC/DC: the ExpiredSignatureError branch must be independently reachable
    and must produce a distinct detail string from InvalidTokenError.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", _SECRET)
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=_credentials(_expired_token()))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Session expired"


# ---------------------------------------------------------------------------
# EP class 5a: structurally malformed token
# ---------------------------------------------------------------------------

def test_require_auth_malformed_token_raises_401(monkeypatch):
    """
    EP class: token string is not a valid JWT at all (garbage input).
    Expected: 401 'Invalid token'.

    BVA: 'not.a.jwt' has the right dot-separated shape but wrong content;
    'garbage' has no dots at all. Both must be rejected identically.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", _SECRET)
    for bad_token in ("not.a.real.jwt", "garbage", "", "Bearer extra.token.here"):
        with pytest.raises(HTTPException) as exc_info:
            require_auth(credentials=_credentials(bad_token))
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid token"


# ---------------------------------------------------------------------------
# EP class 5b: well-formed token signed with the wrong secret (tampered)
# ---------------------------------------------------------------------------

def test_require_auth_wrong_secret_raises_401(monkeypatch):
    """
    EP class: JWT is structurally valid and non-expired, but signed with a
    different secret (simulates a tampered or forged token).
    Expected: 401 'Invalid token'.

    This is the most security-relevant test: it verifies that signature
    verification is actually happening, not just structural parsing.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", _SECRET)
    forged = _valid_token(secret="completely-different-secret-32chars!")
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=_credentials(forged))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


# ---------------------------------------------------------------------------
# MC/DC: expired vs invalid produce distinct detail strings
# ---------------------------------------------------------------------------

def test_require_auth_expired_and_invalid_detail_strings_are_distinct(monkeypatch):
    """
    MC/DC verification: the two exception-handling branches must produce
    different detail strings. If they were collapsed into one 'except Exception'
    block, this test would still pass but the detail would be the same string.
    This test ensures the branches are independently observable.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", _SECRET)

    with pytest.raises(HTTPException) as expired_exc:
        require_auth(credentials=_credentials(_expired_token()))

    with pytest.raises(HTTPException) as invalid_exc:
        require_auth(credentials=_credentials("not.a.real.jwt"))

    assert expired_exc.value.detail != invalid_exc.value.detail
    assert expired_exc.value.detail == "Session expired"
    assert invalid_exc.value.detail == "Invalid token"
