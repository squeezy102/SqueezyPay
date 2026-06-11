"""
Tests for the slowapi rate-limiting behaviour on auth endpoints.
"""


def test_login_rate_limit_429_at_11th_request(client):
    """
    Scenario: POST /api/auth/login is called 11 times using the same rate-key bucket
    EP class: BVA — 10 requests are permitted per minute; the 11th must be rejected
    Expected: the 11th response has HTTP status 429
    """
    # Configure the passphrase so login requests are well-formed
    client.post("/api/auth/setup", json={"passphrase": "TestPassword1234!"})

    last_response = None
    for _ in range(11):
        last_response = client.post("/api/auth/login", json={"passphrase": "TestPassword1234!"})

    assert last_response.status_code == 429
    detail = last_response.json().get("detail", "")
    assert "Rate limit exceeded" in detail
