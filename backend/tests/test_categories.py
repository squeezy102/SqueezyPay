"""
Tests for the /api/categories endpoints.

Coverage:
- GET /api/categories/                      - returns the 20 seeded categories
- POST /api/categories/                     - creates a new category, returns 201 with id + name
- POST /api/categories/ (duplicate)        - second POST with same name returns 409
- PUT /api/categories/{id}                 - renames a category successfully
- PUT /api/categories/{id} (dup name)      - rename to existing name returns 409
- PUT /api/categories/9999                 - non-existent id returns 404
- PUT /api/categories/{id} (same name)    - rename to own current name succeeds (no false 409)
"""

import pytest

# Mirrors the seed list in database/db.py — order here does NOT matter for count tests
_SEED_CATEGORIES = [
    "Housing",
    "Utilities",
    "Internet / Phone",
    "Groceries",
    "Fast Food / Dining Out",
    "Convenience / Gas Station",
    "Online Shopping",
    "Subscriptions / Streaming",
    "Healthcare / Medical",
    "Insurance",
    "Loans / Debt",
    "Education",
    "Entertainment",
    "Travel",
    "Personal Care",
    "Kids",
    "Miscellaneous",
    "Income",
    "Transfer",
    "Bank Fees",
]


@pytest.fixture()
def seeded_client(client):
    """
    The app's lifespan calls init_db(), which seeds the 20 default categories
    into the test database before any request is made.  This fixture simply
    aliases `client` and verifies the seed happened, so tests that need
    pre-populated categories can depend on it explicitly.
    """
    categories = client.get("/api/categories/").json()
    assert len(categories) == 20, (
        f"Expected 20 seeded categories, got {len(categories)}"
    )
    return client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_get_categories(seeded_client):
    response = seeded_client.get("/api/categories/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 20
    names = {item["name"] for item in data}
    assert names == set(_SEED_CATEGORIES)


def test_create_category(client):
    response = client.post("/api/categories/", json={"name": "Pets"})
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["name"] == "Pets"


def test_create_category_duplicate(client):
    client.post("/api/categories/", json={"name": "Pets"})
    response = client.post("/api/categories/", json={"name": "Pets"})
    assert response.status_code == 409


def test_update_category(seeded_client):
    # Grab an existing category to rename
    categories = seeded_client.get("/api/categories/").json()
    target = categories[0]

    response = seeded_client.put(
        f"/api/categories/{target['id']}",
        json={"name": "Renamed Category"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == target["id"]
    assert data["name"] == "Renamed Category"


def test_update_category_duplicate_name(seeded_client):
    categories = seeded_client.get("/api/categories/").json()
    # Rename the first category to the name of the second — should be rejected
    first = categories[0]
    second = categories[1]

    response = seeded_client.put(
        f"/api/categories/{first['id']}",
        json={"name": second["name"]},
    )
    assert response.status_code == 409


def test_update_category_not_found(client):
    response = client.put("/api/categories/9999", json={"name": "Ghost"})
    assert response.status_code == 404


def test_update_category_same_name(seeded_client):
    # Renaming a category to its own current name must NOT return 409
    categories = seeded_client.get("/api/categories/").json()
    target = categories[0]

    response = seeded_client.put(
        f"/api/categories/{target['id']}",
        json={"name": target["name"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == target["name"]
