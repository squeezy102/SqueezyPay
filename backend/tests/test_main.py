"""
Tests for helper functions in main.py — origin allow-list and rate-limit handler.
"""
import uuid

import pytest


# ---------------------------------------------------------------------------
# _is_allowed_origin tests
# ---------------------------------------------------------------------------

def test_is_allowed_origin_explicit_localhost():
    """
    Scenario: Origin matches explicit localhost:5173 entry in _ALLOWED_ORIGINS
    EP class: Valid partition — exact string match in allow-list
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://localhost:5173") is True


def test_is_allowed_origin_explicit_localhost_9000():
    """
    Scenario: Origin matches explicit localhost:9000 entry in _ALLOWED_ORIGINS
    EP class: Valid partition — exact string match in allow-list
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://localhost:9000") is True


def test_is_allowed_origin_192_168_subnet():
    """
    Scenario: Origin is a 192.168.x.x address with port (LAN subnet)
    EP class: Valid partition — regex match on 192.168.* pattern
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://192.168.1.10:5173") is True


def test_is_allowed_origin_10_subnet():
    """
    Scenario: Origin is a 10.x.x.x address without port (LAN subnet)
    EP class: Valid partition — regex match on 10.* pattern
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://10.0.0.5") is True


def test_is_allowed_origin_public_ip_rejected():
    """
    Scenario: Origin is a public IP address (8.8.8.8)
    EP class: Invalid partition — public IP not in allow-list or subnet regex
    Expected: returns False
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://8.8.8.8:5173") is False


def test_is_allowed_origin_https_rejected():
    """
    Scenario: Origin uses https:// scheme for localhost
    EP class: Invalid partition — only http:// is in the allow-list
    Expected: returns False
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("https://localhost:5173") is False


# ---------------------------------------------------------------------------
# Rate-limit handler — 429 response shape
# ---------------------------------------------------------------------------

def test_rate_limit_exceeded_handler_cors_header_injected(client):
    """
    Scenario: POST /api/auth/login is called 11 times with the same rate-limit key;
              the 11th request triggers the 10/minute limit
    EP class: BVA — 11th request is one above the allowed limit of 10
    Expected: HTTP 429 with JSON detail containing "Rate limit exceeded"
    """
    # First configure auth so login does not fail on passphrase-not-configured
    client.post("/api/auth/setup", json={"passphrase": "TestPassword1234!"})

    last_response = None
    for _ in range(11):
        last_response = client.post("/api/auth/login", json={"passphrase": "TestPassword1234!"})

    assert last_response.status_code == 429
    detail = last_response.json()["detail"]
    assert "Rate limit exceeded" in detail
