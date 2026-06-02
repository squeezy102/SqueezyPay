"""
Tests for the /api/settings endpoints.

Coverage:
- GET /api/settings/   - returns default values when DB is empty
- PUT /api/settings/   - updates both keys, response reflects new values
- PUT /api/settings/   - partial update, unchanged key keeps prior value
- PUT /api/settings/   - invalid type for due_soon_days returns 422
"""


def test_get_settings_defaults(client):
    response = client.get("/api/settings/")
    assert response.status_code == 200
    data = response.json()
    assert data["due_soon_days"] == 7
    assert data["large_payment_threshold"] == 500.0


def test_update_settings(client):
    response = client.put("/api/settings/", json={
        "due_soon_days": 14,
        "large_payment_threshold": 1000.0,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["due_soon_days"] == 14
    assert data["large_payment_threshold"] == 1000.0


def test_update_settings_partial(client):
    # First set both to known non-default values
    client.put("/api/settings/", json={
        "due_soon_days": 10,
        "large_payment_threshold": 750.0,
    })

    # Update only one key
    response = client.put("/api/settings/", json={"due_soon_days": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["due_soon_days"] == 3
    # The other key should retain the previously set value
    assert data["large_payment_threshold"] == 750.0


def test_update_settings_invalid_type(client):
    response = client.put("/api/settings/", json={"due_soon_days": "not-a-number"})
    assert response.status_code == 422
