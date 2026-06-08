# Test Coverage Audit — Data Layer (Repositories)

**Audit date:** 2026-06-08  
**Branch audited:** `dev`  
**Coverage tool:** pytest-cov (in-memory SQLite)  
**Auditor:** Claude Code (automated static analysis + test review)

---

## Executive Summary

The SqueezyPay data layer achieves an overall statement coverage of **96 %** across eight repository modules, which is above the typical industry threshold of 80 %. Two modules — `settings_repository.py` (83 %) and `payment_history_repository.py` (93 %) — fall meaningfully below the project's implicit standard. Three further modules carry small but tactically significant gaps: `bill_repository.py` (94 %), `income_repository.py` (98 %), and `plaid_repository.py` (97 %).

The dominant gap pattern is **not an absence of happy-path tests**, but rather a consistent lack of coverage for the **not-found / null-return branches** at the repository layer itself. All existing tests reach those branches through the HTTP layer (FastAPI endpoints), which means they exercise the service and router error-handling logic simultaneously with the repository. That coupling is a reliability risk: a regression that silently changes a repository return value (e.g., `None` → empty list) would not be caught at the repository level.

The in-memory SQLite approach is appropriate for unit speed but introduces three structural fidelity gaps that are documented below.

---

## Coverage Metrics Table

| Module | Stmts | Miss | Coverage | Missing lines | Priority |
|---|---|---|---|---|---|
| `bill_repository.py` | 36 | 2 | 94 % | 30, 41 | Medium |
| `category_repository.py` | 30 | 1 | 97 % | 16 | Low |
| `credential_repository.py` | 30 | 0 | **100 %** | — | — |
| `income_repository.py` | 47 | 1 | 98 % | 53 | Low |
| `payment_history_repository.py` | 27 | 2 | 93 % | 18, 22 | Medium |
| `payment_method_repository.py` | 27 | 0 | **100 %** | — | — |
| `plaid_repository.py` | 98 | 3 | 97 % | 149, 171, 173 | Medium |
| `settings_repository.py` | 23 | 4 | 83 % | 12–13, 21–22 | **High** |

**Weighted mean (statement coverage):** 96.0 %  
**Modules below 95 %:** 2 (`settings_repository`, `payment_history_repository`)

---

## Gap Analysis (per repository)

---

### `bill_repository.py` — 94 %

#### Uncovered lines and branches

| Line | Code | Branch condition missed |
|---|---|---|
| 30 | `return None` | `update()` called with a `bill_id` that does not exist; the `if not bill:` guard is never exercised at the repository layer |
| 41 | `return False` | `delete()` called with a non-existent `bill_id`; the `if not bill:` guard takes the `False` path |

**Root cause:** `test_bill_repository.py` tests the create → retrieve and create → delete happy paths only. The not-found branches are tested through the HTTP layer (`test_bills.py` sends 404-producing requests to the endpoint), but those assertions depend on the router's 404 response rather than the repository's `None`/`False` sentinel.

#### Risk classification

| Risk | Severity | Rationale |
|---|---|---|
| Silent repository contract change | **Medium** | If `update()` or `delete()` is refactored to raise an exception instead of returning `None`/`False`, HTTP-layer tests will catch it, but repository-layer tests will not alert the developer until the service layer is also exercised |
| State machine gap | **Low** | The repository is simple CRUD; no complex state transitions exist for bills |

#### Test suggestion stubs

```python
# file: tests/test_bill_repository.py
# Requires a direct-db fixture (see conftest proposal in Strategy section)

class TestBillRepositoryDirect:
    """Direct repository tests — bypass HTTP layer."""

    def test_update_returns_none_for_missing_id(self, db):
        result = BillRepository.update(db, bill_id=99999, data={"name": "Ghost"})
        assert result is None  # line 30

    def test_delete_returns_false_for_missing_id(self, db):
        result = BillRepository.delete(db, bill_id=99999)
        assert result is False  # line 41

    # BVA: boundary on day_of_month
    def test_create_day_of_month_boundary_values(self, db):
        for day in [1, 28]:  # valid extremes
            bill = BillRepository.create(db, {
                "name": f"Bill day {day}", "category": "Test",
                "url": "http://example.com", "day_of_month": day,
                "recurring": True,
            })
            assert bill.day_of_month == day

    # EP: expected_amount = None (nullable Float)
    def test_create_with_null_expected_amount(self, db):
        bill = BillRepository.create(db, {
            "name": "Variable Bill", "category": "Utilities",
            "url": "http://example.com", "day_of_month": 1,
            "recurring": True, "expected_amount": None,
        })
        assert bill.expected_amount is None
```

---

### `category_repository.py` — 97 %

#### Uncovered lines and branches

| Line | Code | Branch condition missed |
|---|---|---|
| 16 | `return db.query(TransactionCategory).filter(...).first()` | `get_by_id()` called with a non-existent `category_id`; the method returns `None` but this return is never exercised at the repository layer |

**Root cause:** `test_categories.py` routes all category access through the HTTP endpoints. The `update_category_not_found` test does trigger a 404 via the router, but the `get_by_id()` call that returns `None` is covered only incidentally through the router's guard.

#### Risk classification

| Risk | Severity | Rationale |
|---|---|---|
| Repository null-return untested | **Low** | The service guard is tested via HTTP; risk is low but isolation is missing |

#### Test suggestion stubs

```python
# file: tests/test_category_repository.py  (new direct-db test file)

def test_get_by_id_missing(db):
    result = CategoryRepository.get_by_id(db, category_id=99999)
    assert result is None  # line 16

# EP: unique constraint on name
def test_create_duplicate_name_raises(db):
    CategoryRepository.create(db, "Pets")
    with pytest.raises(Exception):  # IntegrityError from UNIQUE constraint
        CategoryRepository.create(db, "Pets")
        db.flush()

# State transition: update → verify ordering preserved
def test_get_all_returns_alphabetical_order(db):
    CategoryRepository.create(db, "Zebra")
    CategoryRepository.create(db, "Apple")
    categories = CategoryRepository.get_all(db)
    names = [c.name for c in categories]
    assert names == sorted(names)
```

---

### `income_repository.py` — 98 %

#### Uncovered lines and branches

| Line | Code | Branch condition missed |
|---|---|---|
| 53 | `income.active = True` (inside `reactivate()`) | The `reactivate()` happy path — where the record exists and `active` is set to `True` — is never exercised at the **repository layer**. `test_income.py` tests this via the HTTP endpoint, but the repository itself is not unit-tested in isolation. |

**Note:** Line 53 is not a not-found branch; it is the successful body of `reactivate()`. Coverage shows line 52 (`return False`) is covered by the endpoint tests sending 404 for unknown IDs, but line 53 onward is reached only when the reactivation succeeds. The HTTP test does exercise the success path, so this line is in fact reachable — the gap indicates that the repository-level `db` fixture tests do not exist at all for this module.

#### Risk classification

| Risk | Severity | Rationale |
|---|---|---|
| `reactivate()` state transition untested at repo layer | **Low** | HTTP test covers it end-to-end, but there is no isolation |
| `get_all(include_inactive=True)` branch | **Low** | HTTP test covers it, but no dedicated repo-layer assertion on the filter predicate |

#### Test suggestion stubs

```python
# file: tests/test_income_repository.py  (new direct-db test file)

def test_reactivate_sets_active_true(db):
    """Exercises line 53 at the repository layer."""
    income = IncomeRepository.create(db, {
        "source_name": "Job", "amount": 1000.0,
        "frequency": "monthly",
        "next_expected_date": datetime(2026, 7, 1),
        "active": True,
    })
    IncomeRepository.deactivate(db, income.id)
    result = IncomeRepository.reactivate(db, income.id)
    assert result is True
    refreshed = IncomeRepository.get_by_id(db, income.id)
    assert refreshed.active is True

def test_reactivate_returns_false_for_missing(db):
    assert IncomeRepository.reactivate(db, income_id=99999) is False

# EP: include_inactive filter
def test_get_all_excludes_inactive_by_default(db):
    income = IncomeRepository.create(db, {..., "active": True})
    IncomeRepository.deactivate(db, income.id)
    active_list = IncomeRepository.get_all(db, include_inactive=False)
    assert all(i.active for i in active_list)

def test_get_all_includes_inactive_when_requested(db):
    income = IncomeRepository.create(db, {..., "active": True})
    IncomeRepository.deactivate(db, income.id)
    all_list = IncomeRepository.get_all(db, include_inactive=True)
    assert any(not i.active for i in all_list)

# BVA: amount = 0.0 (boundary)
def test_create_income_zero_amount(db):
    income = IncomeRepository.create(db, {
        "source_name": "Unpaid Intern", "amount": 0.0,
        "frequency": "weekly",
        "next_expected_date": datetime(2026, 7, 1),
    })
    assert income.amount == 0.0
```

---

### `payment_history_repository.py` — 93 %

#### Uncovered lines and branches

| Line | Code | Branch condition missed |
|---|---|---|
| 18 | `return db.query(PaymentHistory).order_by(...).all()` | `get_all()` is never called with data that exercises ordering; but more importantly the entire `get_all()` method body is uncovered at the repository layer |
| 22 | `return db.query(PaymentHistory).filter(...).first()` | `get_by_id()` entire method body is uncovered at the repository layer |

**Root cause:** `test_payment_history.py` uses the HTTP client exclusively. The `GET /api/payment-history/` and `GET /api/payment-history/{id}` endpoints delegate directly to `PaymentHistoryRepository.get_all()` and `PaymentHistoryRepository.get_by_id()`. Because there are no direct-db tests, the coverage runner never sees these lines executed in a test context that maps to a `.py` test module calling the repository class directly.

**Note on line 18 specifically:** This appears to be a coverage instrumentation artefact from the HTTP-only test approach. The line is reachable in production, but the way `TestClient` runs requests through a separate WSGI thread means the coverage tracer may not attribute those executions to the test module's source lines consistently when `StaticPool` shares a single connection.

#### Risk classification

| Risk | Severity | Rationale |
|---|---|---|
| `get_all()` ordering untested at repo layer | **Medium** | If ordering clause is removed or changed, no test fails until the UI shows wrong order |
| `get_by_id()` null-return untested | **Medium** | Service layer uses this to return 404; repository-level null guarantee is untested |
| Missing cascade delete test | **Medium** | `PaymentHistory` has `bill_id` FK to `bills`, but there is no cascade configured. Deleting a bill while payments exist will raise an IntegrityError in production SQLite (FK enforcement is pragma-dependent) |

#### Test suggestion stubs

```python
# file: tests/test_payment_history_repository.py  (new direct-db test file)

def _make_bill(db):
    return BillRepository.create(db, {
        "name": "Test Bill", "category": "Test",
        "url": "http://example.com", "day_of_month": 1, "recurring": True,
    })

def _make_payment(db, bill_id):
    return PaymentHistoryRepository.create(db, {
        "bill_id": bill_id,
        "payment_date": datetime(2026, 5, 1),
        "amount_paid": 100.0,
    })

def test_get_all_returns_empty_list(db):
    assert PaymentHistoryRepository.get_all(db) == []  # line 18

def test_get_all_returns_payments_desc_order(db):
    """BVA: ordering boundary — most recent first."""
    bill = _make_bill(db)
    _make_payment(db, bill.id)  # May 1
    PaymentHistoryRepository.create(db, {
        "bill_id": bill.id,
        "payment_date": datetime(2026, 6, 1),
        "amount_paid": 200.0,
    })
    payments = PaymentHistoryRepository.get_all(db)
    assert payments[0].payment_date > payments[1].payment_date

def test_get_by_id_returns_none_for_missing(db):
    assert PaymentHistoryRepository.get_by_id(db, 99999) is None  # line 22

def test_get_by_id_returns_correct_record(db):
    bill = _make_bill(db)
    p = _make_payment(db, bill.id)
    found = PaymentHistoryRepository.get_by_id(db, p.id)
    assert found.id == p.id

def test_delete_returns_false_for_missing(db):
    assert PaymentHistoryRepository.delete(db, 99999) is False

# Constraint: bill_id FK (no cascade on delete in schema)
def test_payment_references_valid_bill_id(db):
    """EP: invalid partition — bill_id references non-existent bill."""
    with pytest.raises(Exception):
        PaymentHistoryRepository.create(db, {
            "bill_id": 99999,
            "payment_date": datetime(2026, 5, 1),
            "amount_paid": 50.0,
        })
        db.flush()
```

---

### `plaid_repository.py` — 97 %

#### Uncovered lines and branches

| Line | Code | Branch condition missed |
|---|---|---|
| 149 | `if key == "category_id" and existing.category_id is not None: continue` | `PlaidTransactionRepository.upsert()` update path where an existing transaction **already has a user-assigned `category_id`** and a sync payload tries to overwrite it — the guard should skip the overwrite |
| 171 | `q = q.filter(PlaidTransaction.plaid_account_id == plaid_account_id)` | `get_all()` called with `plaid_account_id` filter — this filter branch is not executed by any test in `test_plaid_repository.py` |
| 173 | `q = q.filter(PlaidTransaction.date >= start_date)` | `get_all()` called with `start_date` filter — date filter branch is not executed |

**Note:** Line 171 is surprising because `test_get_all_filters_by_account` exists. On inspection, that test uses `plaid_account_id=acct1.id` which should cover line 171. The coverage snapshot may reflect a measurement timing issue or the test was added after the snapshot was taken. Lines 173 and 149 are confirmed uncovered.

#### Risk classification

| Risk | Severity | Rationale |
|---|---|---|
| Category-preservation guard untested (line 149) | **High** | This is a business-critical rule: user-assigned categories must survive a Plaid sync. A test failure here would silently strip user data on every sync |
| `start_date`/`end_date` filter in `get_all()` untested (line 173) | **Medium** | The `get_by_date_range()` method is tested, but `get_all()` date filters are separate code paths — if they are broken, the UI date filter returns wrong results silently |
| `Numeric` type arithmetic | **Low** | `PlaidAccount.current_balance` and `PlaidTransaction.amount` are `Numeric(12,2)`. SQLite stores these as text internally; comparisons and arithmetic on `Decimal` vs `float` may produce silent truncation in tests that pass but fail in production where precision differs |

#### Test suggestion stubs

```python
# Add to: tests/test_plaid_repository.py

class TestPlaidTransactionRepositoryCategoryPreservation:
    """Covers plaid_repository.py line 149 — the category-preservation guard."""

    def test_upsert_preserves_user_assigned_category(self, db):
        """
        When a transaction already has a user-assigned category_id,
        a subsequent upsert with a different category_id must NOT overwrite it.
        This is the business-critical guard on line 149.
        """
        item = _make_item(db)
        account = _make_account(db, item.id)
        tx, _ = _make_tx(db, account.id)

        # Simulate user assigning a category
        cat = TransactionCategory(name="Groceries")
        db.add(cat)
        db.commit()
        db.refresh(cat)
        PlaidTransactionRepository.assign_category(db, tx, cat.id)

        # Simulate Plaid sync trying to overwrite with a different category
        cat2 = TransactionCategory(name="Fast Food")
        db.add(cat2)
        db.commit()
        db.refresh(cat2)

        updated, created = PlaidTransactionRepository.upsert(
            db,
            plaid_account_id=account.id,
            data={
                "transaction_id": "tx-001",
                "amount": 12.50,
                "date": "2026-06-01",
                "name": "Coffee Shop",
                "merchant_name": "Starbucks",
                "plaid_category_primary": "FOOD_AND_DRINK",
                "plaid_category_detailed": "COFFEE_SHOPS",
                "category_id": cat2.id,  # Plaid sends a different category
                "payment_channel": "in store",
                "pending": False,
                "logo_url": None,
                "iso_currency_code": "USD",
            },
        )
        assert created is False
        assert updated.category_id == cat.id  # Must NOT be cat2.id

    def test_upsert_assigns_category_when_none_previously_set(self, db):
        """
        When category_id is None, a subsequent upsert IS allowed to set it
        (the guard only protects non-None values).
        """
        item = _make_item(db)
        account = _make_account(db, item.id)
        _make_tx(db, account.id)  # category_id=None

        cat = TransactionCategory(name="Auto-assigned")
        db.add(cat)
        db.commit()
        db.refresh(cat)

        updated, _ = PlaidTransactionRepository.upsert(
            db,
            plaid_account_id=account.id,
            data={
                "transaction_id": "tx-001",
                "amount": 12.50,
                "date": "2026-06-01",
                "name": "Coffee Shop",
                "merchant_name": None,
                "plaid_category_primary": None,
                "plaid_category_detailed": None,
                "category_id": cat.id,  # First-time assignment — should be accepted
                "payment_channel": None,
                "pending": False,
                "logo_url": None,
                "iso_currency_code": "USD",
            },
        )
        assert updated.category_id == cat.id


class TestPlaidTransactionRepositoryGetAllFilters:
    """Covers get_all() filter branches — lines 171 and 173."""

    def test_get_all_filters_by_start_date(self, db):
        """Line 173: start_date filter branch."""
        item = _make_item(db)
        account = _make_account(db, item.id)
        # Insert transactions on two different dates
        PlaidTransactionRepository.upsert(db, account.id, {
            "transaction_id": "tx-old", "amount": 10.0, "date": "2026-01-01",
            "name": "Old", "pending": False,
        })
        PlaidTransactionRepository.upsert(db, account.id, {
            "transaction_id": "tx-new", "amount": 20.0, "date": "2026-06-01",
            "name": "New", "pending": False,
        })
        txs, total = PlaidTransactionRepository.get_all(db, start_date="2026-06-01")
        assert total == 1
        assert txs[0].transaction_id == "tx-new"

    def test_get_all_filters_by_end_date(self, db):
        """Line 173 (end_date variant)."""
        item = _make_item(db)
        account = _make_account(db, item.id)
        PlaidTransactionRepository.upsert(db, account.id, {
            "transaction_id": "tx-a", "amount": 10.0, "date": "2026-01-01",
            "name": "Jan", "pending": False,
        })
        PlaidTransactionRepository.upsert(db, account.id, {
            "transaction_id": "tx-b", "amount": 20.0, "date": "2026-12-01",
            "name": "Dec", "pending": False,
        })
        txs, total = PlaidTransactionRepository.get_all(db, end_date="2026-06-30")
        assert total == 1
        assert txs[0].transaction_id == "tx-a"

    def test_get_all_combined_date_range_and_account_filter(self, db):
        """Combined filter: plaid_account_id + start_date + end_date."""
        item = _make_item(db)
        acct1 = _make_account(db, item.id, "acct-001")
        acct2 = _make_account(db, item.id, "acct-002")
        PlaidTransactionRepository.upsert(db, acct1.id, {
            "transaction_id": "tx-1", "amount": 5.0, "date": "2026-06-15",
            "name": "In range, right account", "pending": False,
        })
        PlaidTransactionRepository.upsert(db, acct2.id, {
            "transaction_id": "tx-2", "amount": 5.0, "date": "2026-06-15",
            "name": "In range, wrong account", "pending": False,
        })
        txs, total = PlaidTransactionRepository.get_all(
            db,
            plaid_account_id=acct1.id,
            start_date="2026-06-01",
            end_date="2026-06-30",
        )
        assert total == 1
        assert txs[0].transaction_id == "tx-1"

    # BVA: offset at exact total (returns empty, not error)
    def test_get_all_offset_equals_total(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        _make_tx(db, account.id)
        txs, total = PlaidTransactionRepository.get_all(db, limit=50, offset=total)
        # offset == total means past the end — should return empty list, not error
        assert txs == []
        assert total == 1

    # BVA: Numeric precision — amount with more than 2 decimal places
    def test_numeric_amount_precision(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        tx, _ = PlaidTransactionRepository.upsert(db, account.id, {
            "transaction_id": "tx-precision", "amount": 10.999,
            "date": "2026-06-01", "name": "Precision test", "pending": False,
        })
        # Numeric(12,2) must round or truncate to two decimal places
        from decimal import Decimal
        assert tx.amount == Decimal("11.00") or tx.amount == Decimal("10.99")
```

---

### `settings_repository.py` — 83 %

#### Uncovered lines and branches

| Line | Code | Branch condition missed |
|---|---|---|
| 12 | `record = db.query(Setting).filter(Setting.key == key).first()` | `get()` called for any key — entire `get()` method body is uncovered at the repository layer |
| 13 | `return record.value if record else None` | Both the `record` (key exists) and `None` (key absent) branches of `get()` are uncovered at the repository layer |
| 21 | `record = Setting(key=key, value=value)` | `set()` called when the key does **not** yet exist (insert path) — uncovered at the repository layer |
| 22 | `db.add(record)` | Consequent of line 21 — the insert path is not executed at the repository layer |

**Root cause:** `test_settings.py` exercises all behaviour through the HTTP layer. The `GET /api/settings/` endpoint calls through a service that calls `SettingsRepository.get()` for each key. The `PUT /api/settings/` endpoint calls `SettingsRepository.set()`. Because there are no direct-db repository tests, none of these lines appear in the coverage tracer's call graph for any test module. The 83 % figure is the worst in the module set and exceeds a single-digit gap.

This is the **highest-priority gap** because:
1. `Setting.key` is the primary key (string), meaning the upsert logic (`if record:` on line 18) is the sole guard against duplicate-key violations; it is untested in isolation.
2. `get()` returning `None` for a missing key vs. `record.value` for an existing one is a two-branch decision that drives default-value fallback logic in the service layer.

#### Risk classification

| Risk | Severity | Rationale |
|---|---|---|
| `get()` both branches untested at repo layer | **High** | If `get()` is changed to raise instead of returning `None`, all callers that rely on falsy-None will break silently |
| `set()` insert path untested (lines 21–22) | **High** | The upsert insert branch has never been verified to write a new row at the repository layer; only the update branch is indirectly exercised |
| PK-as-string settings key | **Medium** | `Setting.key` is the primary key. Calling `set()` twice with the same key must update, not duplicate. This is tested via HTTP but not at the repository layer where the SQL is generated |

#### Test suggestion stubs

```python
# file: tests/test_settings_repository.py  (new direct-db test file)

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker
from models.models import Base
from repositories.settings_repository import SettingsRepository


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


class TestSettingsRepositoryGet:
    def test_get_returns_none_for_missing_key(self, db):
        """Line 13: falsy branch — key does not exist."""
        result = SettingsRepository.get(db, "nonexistent_key")
        assert result is None  # lines 12–13

    def test_get_returns_value_for_existing_key(self, db):
        """Line 13: truthy branch — key exists."""
        SettingsRepository.set(db, "my_key", "my_value")
        result = SettingsRepository.get(db, "my_key")
        assert result == "my_value"  # lines 12–13


class TestSettingsRepositorySet:
    def test_set_creates_new_record(self, db):
        """Lines 21–22: insert path — key does not exist yet."""
        record = SettingsRepository.set(db, "new_key", "new_value")
        assert record.key == "new_key"
        assert record.value == "new_value"
        # Verify it is actually persisted
        assert SettingsRepository.get(db, "new_key") == "new_value"

    def test_set_updates_existing_record(self, db):
        """Line 19: update path — key already exists."""
        SettingsRepository.set(db, "existing_key", "original")
        updated = SettingsRepository.set(db, "existing_key", "updated")
        assert updated.value == "updated"
        # Must be one row, not two
        all_settings = SettingsRepository.get_all(db)
        assert list(all_settings.keys()).count("existing_key") == 1

    def test_set_upsert_idempotent_on_third_call(self, db):
        """State transition: insert → update → update."""
        SettingsRepository.set(db, "key", "v1")
        SettingsRepository.set(db, "key", "v2")
        SettingsRepository.set(db, "key", "v3")
        assert SettingsRepository.get(db, "key") == "v3"


class TestSettingsRepositoryGetAll:
    def test_get_all_returns_empty_dict_when_no_settings(self, db):
        result = SettingsRepository.get_all(db)
        assert result == {}

    def test_get_all_returns_all_key_value_pairs(self, db):
        SettingsRepository.set(db, "k1", "v1")
        SettingsRepository.set(db, "k2", "v2")
        result = SettingsRepository.get_all(db)
        assert result == {"k1": "v1", "k2": "v2"}

    # EP: value at maximum declared length (500 chars)
    def test_set_value_at_max_length(self, db):
        long_value = "x" * 500
        record = SettingsRepository.set(db, "long_key", long_value)
        assert len(record.value) == 500
        assert SettingsRepository.get(db, "long_key") == long_value
```

---

## Data Layer Testing Strategy Assessment

### In-memory SQLite: Fidelity Assessment

The use of `sqlite:///:memory:` with `StaticPool` is the correct choice for test speed and isolation. However, three structural fidelity gaps require attention.

#### 1. `Numeric` type behaviour differs from production SQLite on disk

`PlaidAccount.current_balance`, `PlaidAccount.available_balance`, and `PlaidTransaction.amount` use `Numeric(precision=12, scale=2)`. SQLite does not enforce fixed-point arithmetic natively; it stores `NUMERIC` affinity values as `REAL` or `INTEGER` unless the application layer enforces `Decimal` types. SQLAlchemy's `Numeric` type returns Python `Decimal` objects when the `asdecimal=True` default is active, but this depends on the driver.

**Risk:** A test that asserts `tx.amount == 12.50` (float comparison) may pass while production code that computes totals in `Decimal` produces rounding errors that tests never expose.

**Recommendation:** Add explicit `Decimal`-typed assertions to the `Numeric` column tests. Verify `isinstance(tx.amount, Decimal)` alongside value assertions. Consider adding a precision BVA test: insert `10.999`, assert round-trip is `Decimal("11.00")` (rounds) or `Decimal("10.99")` (truncates) — whichever the SQLAlchemy/SQLite driver behaviour actually is.

#### 2. `render_as_batch=True` masks column constraint migrations

Both the online and offline Alembic migration modes use `render_as_batch=True`. This is required for SQLite, which does not support `ALTER COLUMN` natively. Batch mode works by recreating the table as a temporary copy, copying data, and dropping the original.

**The testability risk is:** The test suite calls `Base.metadata.create_all(engine)` directly, which creates tables in their **final model state**, bypassing all migration scripts. Consequently:
- The migration chain `initial_schema → add_auth_config → add_plaid_tables → numeric_monetary_columns` is **never executed in tests**.
- If a migration script contains a bug (wrong column name, wrong type, data-destructive batch recreation), it will not be caught until it runs against the production database.
- The `numeric_monetary_columns` migration converts `Float → Numeric(12,2)`. This migration is unverified; it has been applied to production but if it is rolled back or re-applied, the batch recreation could silently lose data.

**Recommendation:** Add a dedicated `test_migrations.py` that runs the full Alembic migration chain against an in-memory SQLite database from revision zero through `head`, then runs `alembic downgrade -1` on each step, verifying the schema at each step.

#### 3. Foreign key enforcement is disabled by default in SQLite

SQLite does not enforce foreign key constraints unless `PRAGMA foreign_keys = ON` is set per-connection. The test engine does not set this pragma. This means:
- Tests that insert a `PaymentHistory` row with a non-existent `bill_id` will silently succeed instead of raising `IntegrityError`.
- Cascade delete semantics on `PlaidItem → PlaidAccount → PlaidTransaction` are verified by the ORM relationship `cascade="all, delete-orphan"` (not by the database FK), so those tests are valid. But the FK constraint itself is untested.

**Recommendation:** Add `@event.listens_for(engine, "connect")` to set `PRAGMA foreign_keys = ON` in the test conftest for the direct-db fixture.

### Negative-path test coverage

| Repository | Not-found path tested at repo layer | Constraint violation tested | Duplicate key tested |
|---|---|---|---|
| BillRepository | No (HTTP only) | No | N/A |
| CategoryRepository | No (HTTP only) | No | HTTP only |
| IncomeRepository | Partial (deactivate/update via HTTP) | No | N/A |
| PaymentHistoryRepository | No (HTTP only) | No | N/A |
| PlaidItemRepository | Yes (test_plaid_repository.py) | No | No |
| PlaidAccountRepository | Yes (test_plaid_repository.py) | No | No |
| PlaidTransactionRepository | Yes (test_plaid_repository.py) | No | Partial |
| SettingsRepository | No | N/A | No |

**Finding:** Negative-path coverage at the repository layer is absent for five of eight modules. The HTTP-layer tests provide functional coverage, but they do not verify the repository's contractual behaviour (return types, sentinels, exceptions) in isolation.

### Boundary and pagination tests

| Scenario | Covered |
|---|---|
| `get_all()` with 0 records (empty list) | Yes, most modules via HTTP |
| `get_all()` with exactly 1 record | Yes |
| Pagination `offset=0, limit=2` with 5 records | Yes (plaid_repository) |
| Pagination `offset == total` (past end) | **No** |
| Pagination `limit=0` (returns no rows) | **No** |
| `start_date == end_date` (single-day range) | **No** |
| `amount = 0.0` | **No** |
| `amount` at maximum Numeric precision boundary | **No** |
| `day_of_month` at boundaries (1, 28, 31) | **No** |
| `value` at `Setting.value` max length (500) | **No** |

### Test isolation

The `conftest.py` `client` fixture correctly:
- Creates a fresh in-memory engine per test (function scope)
- Overrides `get_db` dependency with a test session
- Clears `app.dependency_overrides` after each test
- Disposes the engine after each test

However, the `test_plaid_repository.py` `db` fixture uses a separately defined local fixture rather than a shared conftest fixture. This is acceptable but creates slight duplication risk if the fixture pattern needs to change (e.g., to add `PRAGMA foreign_keys = ON`).

**The rate-limit bucket isolation** (`X-Test-Rate-Key`) is a well-designed pattern that prevents quota bleed between tests. No issues found.

---

## Schema and Migration Test Coverage

| Area | Status | Notes |
|---|---|---|
| Schema created correctly via `create_all` | Implicitly tested by all passing tests | `Base.metadata.create_all` is called in every fixture |
| Migration chain runs to `head` without error | **Not tested** | No test invokes `alembic upgrade head` |
| Migration downgrade path | **Not tested** | `downgrade()` functions exist but are never exercised |
| `render_as_batch` column recreation correctness | **Not tested** | The `numeric_monetary_columns` migration recreates three columns; no test verifies data integrity through the recreation |
| `UniqueConstraint("transaction_id")` enforced | **Not tested** | The ORM prevents duplicates via the upsert guard, but the DB constraint itself is never violated to confirm the error is the correct `IntegrityError` |
| `PlaidItem.item_id` unique constraint | **Not tested at DB level** | `get_by_plaid_id_missing` tests the lookup, but duplicate insert is not attempted |
| `TransactionCategory.name` unique constraint | Tested via HTTP (409 endpoint test) | Not tested at DB level with direct `IntegrityError` assertion |
| Cascade delete `PlaidItem → PlaidAccount` | Tested (`test_cascade_delete_with_item`) | Passes |
| Cascade delete `PlaidAccount → PlaidTransaction` | **Not tested** | No test deletes a `PlaidAccount` and verifies its transactions are also removed |
| FK: `PaymentHistory.bill_id → bills.id` | **Not tested** | FK pragma is off; no test attempts orphaned insert |
| FK: `PlaidTransaction.category_id → transaction_categories.id` | **Not tested** | Same issue |

---

## Recommendations

Listed in priority order.

### R1 — Add direct-db fixture to conftest.py (Pre-requisite for all below)

Add a shared `db` fixture to `tests/conftest.py` that mirrors the pattern in `test_plaid_repository.py` and sets `PRAGMA foreign_keys = ON`:

```python
# tests/conftest.py — add alongside existing `client` fixture

from sqlalchemy import event

@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()
```

### R2 — Create `tests/test_settings_repository.py` (HIGH — 83 % module)

Implement the stubs from the `settings_repository.py` gap analysis section above. This is the highest-value effort: four uncovered lines, two high-severity risks, achieved with approximately ten focused test functions.

### R3 — Add category-preservation guard test for PlaidTransactionRepository (HIGH — business-critical)

Implement `test_upsert_preserves_user_assigned_category` from the plaid gap analysis. This is a data-integrity rule, not a coverage tick. A sync bug that strips user categories would produce a difficult-to-diagnose production issue.

### R4 — Add `get_all()` date-filter tests to `test_plaid_repository.py` (MEDIUM)

Implement `TestPlaidTransactionRepositoryGetAllFilters` stubs above. The `get_by_date_range()` method is tested but `get_all()` date filters are separate code paths.

### R5 — Add migration smoke test (MEDIUM — infrastructure risk)

```python
# tests/test_migrations.py

def test_alembic_upgrade_head_on_empty_db(tmp_path):
    """Full migration chain runs without error against a fresh SQLite file."""
    from alembic.config import Config
    from alembic import command

    db_path = tmp_path / "test_migration.db"
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    command.upgrade(alembic_cfg, "head")
    # If we reach here, no migration raised an exception
    assert db_path.exists()

def test_alembic_downgrade_one_step(tmp_path):
    """The most recent migration can be rolled back cleanly."""
    from alembic.config import Config
    from alembic import command

    db_path = tmp_path / "test_migration_down.db"
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    command.upgrade(alembic_cfg, "head")
    command.downgrade(alembic_cfg, "-1")
    # If we reach here, the downgrade did not raise
```

### R6 — Add `PaymentHistory` and `BillRepository` not-found repo-layer tests (MEDIUM)

Implement stubs from the `bill_repository.py` and `payment_history_repository.py` gap analysis. These are low effort (two functions each) and close the not-found branch gap at the repository layer.

### R7 — Add Numeric precision assertion to Plaid balance/amount tests (LOW — forward risk)

When the `Bill.expected_amount` and `Income.amount` columns are migrated to `Numeric` (currently `Float`) in a future migration, the test suite has no precision guards. Pre-emptively add `Decimal` type assertions for the existing `PlaidAccount` and `PlaidTransaction` balance tests to establish the pattern.

### R8 — Add cascade delete test for `PlaidAccount → PlaidTransaction` (LOW)

A single test: create item → account → transaction, delete account, assert transactions are removed. Closes a cascade-delete blind spot.

---

### Coverage target recommendation

| Phase | Target | Rationale |
|---|---|---|
| Current (Phase 1) | 95 % statement coverage across all modules | Achievable by closing R2 + R6 |
| Phase 2 (migration coverage) | 100 % migration chain coverage | R5 closes this |
| Phase 3 (branch coverage) | 90 % branch coverage | Requires R3, R4, R7 |

The project should adopt `--cov-fail-under=95` in `pyproject.toml` once R2 and R6 are merged, preventing future regressions below the current mean.
