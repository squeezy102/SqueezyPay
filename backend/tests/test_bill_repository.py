"""
Smoke tests confirming BillRepository is correctly wired into BillService
and accessible through the /api/bills endpoints.

Coverage:
- POST /api/bills/ then GET /api/bills/{id}     - data round-trips through repository
- POST then DELETE then GET /                   - deletion confirmed, bill gone from list
"""
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base
from repositories.bill_repository import BillRepository

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


# ---------------------------------------------------------------------------
# Repository-layer (direct DB) tests
# ---------------------------------------------------------------------------


@pytest.fixture()
def repo_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def _make_bill(db):
    return BillRepository.create(
        db,
        {
            "name": "Test Bill",
            "category": "Utilities",
            "url": "https://example.com",
            "day_of_month": 15,
            "recurring": True,
        },
    )


def test_bill_repository_update_not_found_returns_none(repo_db):
    """
    Scenario: update() called with an ID that does not exist in the database
    EP class: invalid partition — non-existent primary key (boundary: min valid id - 1 is effectively any gap)
    Expected: BillRepository.update returns None without raising
    """
    result = BillRepository.update(repo_db, 9999, {"name": "x"})
    assert result is None


def test_bill_repository_delete_not_found_returns_false(repo_db):
    """
    Scenario: delete() called with an ID that does not exist in the database
    EP class: invalid partition — non-existent primary key
    Expected: BillRepository.delete returns False without raising
    """
    result = BillRepository.delete(repo_db, 9999)
    assert result is False


def test_bill_repository_get_by_id_not_found(repo_db):
    """
    Scenario: get_by_id() called with an ID that does not exist in the database
    EP class: invalid partition — non-existent primary key
    Expected: BillRepository.get_by_id returns None
    """
    result = BillRepository.get_by_id(repo_db, 9999)
    assert result is None


def test_bill_repository_get_all_empty(repo_db):
    """
    Scenario: get_all() called on a database with no bills
    EP class: boundary — empty table (count = 0)
    Expected: BillRepository.get_all returns an empty list
    """
    result = BillRepository.get_all(repo_db)
    assert result == []


def test_bill_repository_update_existing(repo_db):
    """
    Scenario: update() called on a bill that exists, changing its name
    EP class: valid partition — existing record, single field mutation
    Expected: returned bill reflects the new name; change is persisted (get_by_id confirms)
    """
    bill = _make_bill(repo_db)
    updated = BillRepository.update(repo_db, bill.id, {"name": "Updated Bill"})
    assert updated is not None
    assert updated.name == "Updated Bill"
    # Confirm persisted
    fetched = BillRepository.get_by_id(repo_db, bill.id)
    assert fetched.name == "Updated Bill"
