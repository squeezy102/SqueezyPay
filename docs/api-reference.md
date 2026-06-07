# API Reference

The backend runs on `http://localhost:8000`. Interactive documentation (Swagger UI) is available at `http://localhost:8000/docs`.

All protected routes require a valid JWT in the `Authorization` header:
```
Authorization: Bearer <token>
```

Tokens are obtained via `POST /api/auth/login`.

## Auth

### `POST /api/auth/login`
Authenticate with the household passphrase and receive a JWT.

**Request:**
```json
{ "passphrase": "your-passphrase" }
```

**Response `200`:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

**Response `401`:** Invalid passphrase.

---

### `POST /api/auth/logout`
Invalidate the current session. The token is blocklisted server-side.

---

## Bills

### `GET /api/bills`
List all active bills.

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "Electric",
    "amount": 120.00,
    "due_day": 15,
    "url": "https://...",
    "category": "Utilities",
    "is_active": true,
    "notes": null,
    "created_at": "2025-01-01T00:00:00"
  }
]
```

---

### `POST /api/bills`
Create a bill.

**Request:**
```json
{
  "name": "Electric",
  "amount": 120.00,
  "due_day": 15,
  "url": "https://...",
  "category": "Utilities",
  "notes": null
}
```

---

### `PUT /api/bills/{id}`
Update a bill.

---

### `DELETE /api/bills/{id}`
Soft-delete a bill (`is_active = false`).

---

### `POST /api/bills/{bill_id}/autofill`
Launch a Playwright browser worker that navigates to the bill's URL and fills the login fields with stored credentials.

**Response `200`:**
```json
{ "filled": true }
```
`filled` is `true` if the browser opened and fields were filled (or the worker is still running with fields filled), `false` if the worker ran but could not locate or fill the fields.

**Response `404`:** Bill not found, or no credential is stored for this bill.

**Behaviour notes:**
- The worker navigates with `networkidle` wait, then tries a prioritized list of CSS selectors for username/email and password fields.
- If filling fails on the first attempt it retries once (checking `document.activeElement` and field values before retrying).
- A `TimeoutExpired` after 12 s is treated as success — it means the browser is open.
- **Known limitation:** Playwright always opens a new browser window. It cannot open a tab in an existing browser window.

---

## Payments

### `GET /api/payments`
List all payment records, newest first.

**Query params:**
- `bill_id` (int, optional) — filter by bill
- `limit` (int, default 50)
- `offset` (int, default 0)

**Response `200`:**
```json
{
  "payments": [...],
  "total": 42
}
```

---

### `POST /api/payments`
Log a payment.

**Request:**
```json
{
  "bill_id": 1,
  "amount": 120.00,
  "paid_date": "2025-06-01",
  "confirmation_number": "ABC123",
  "notes": null
}
```

---

### `DELETE /api/payments/{id}`
Delete a payment record.

---

## Income

### `GET /api/income`
List configured income streams.

---

### `POST /api/income`
Create an income stream.

**Request:**
```json
{
  "name": "Salary",
  "amount": 3000.00,
  "frequency": "biweekly",
  "next_expected_date": "2025-06-14"
}
```

---

### `PUT /api/income/{id}`
Update an income stream.

---

### `DELETE /api/income/{id}`
Delete an income stream.

---

## Settings

### `GET /api/settings`
Get all settings as a key-value map.

**Response `200`:**
```json
{
  "due_soon_days": 7,
  "large_payment_threshold": 500.0
}
```

`due_soon_days` — how many days before a bill's due date it is flagged as "due soon" on the dashboard.
`large_payment_threshold` — payments above this amount are highlighted in the payment history.

---

### `PUT /api/settings`
Update one or more settings.

**Request:**
```json
{ "due_soon_days": 5 }
```

---

### `POST /api/settings/change-passphrase`
Change the household passphrase.

**Request:**
```json
{ "current_passphrase": "old", "new_passphrase": "new" }
```

---

## Plaid

### `POST /api/plaid/link-token`
Create a Plaid Link token to initialize the Link flow.

**Response `200`:**
```json
{ "link_token": "link-sandbox-..." }
```

**Response `503`:** Plaid credentials not configured.

---

### `POST /api/plaid/exchange-token`
Exchange a Plaid public token for a persistent access token. Stores the item and syncs initial accounts.

**Single-institution constraint:** Returns `409` if an item is already connected.

**Request:**
```json
{ "public_token": "public-sandbox-..." }
```

**Response `201`:**
```json
{
  "id": 1,
  "item_id": "abc123",
  "institution_name": "First Platypus Bank",
  "created_at": "2025-06-01T12:00:00"
}
```

**Response `409`:** Institution already connected.

---

### `GET /api/plaid/items`
List connected Plaid items (0 or 1 in the current design).

---

### `DELETE /api/plaid/items/{item_id}`
Disconnect a Plaid item. Calls `item/remove` with Plaid, then deletes the local record and all associated accounts and transactions.

**Response `204`:** Disconnected.
**Response `404`:** Item not found.

---

### `GET /api/plaid/accounts`
List synced accounts.

**Response `200`:**
```json
[
  {
    "id": 1,
    "account_id": "xyz",
    "name": "Checking",
    "official_name": "JOINT CHECKING",
    "type": "depository",
    "subtype": "checking",
    "mask": "1234",
    "current_balance": 2500.00,
    "available_balance": 2480.00,
    "balance_synced_at": "2025-06-01T12:00:00",
    "institution_name": "First Platypus Bank"
  }
]
```

---

### `POST /api/plaid/accounts/sync-balances`
Pull live balances from Plaid for all accounts in the given item.

**Request:**
```json
{ "plaid_item_id": 1 }
```

**Response `200`:** Updated account list (same shape as `GET /api/plaid/accounts`).

---

### `GET /api/plaid/transactions`
List synced transactions.

**Query params:**
- `account_id` (int, optional)
- `start_date` (YYYY-MM-DD, optional)
- `end_date` (YYYY-MM-DD, optional)
- `limit` (int, default 50, max 200)
- `offset` (int, default 0)

**Response `200`:**
```json
{
  "transactions": [...],
  "total": 124
}
```

Each transaction:
```json
{
  "id": 1,
  "transaction_id": "plaid-tx-abc",
  "plaid_account_id": 1,
  "amount": 45.99,
  "date": "2025-06-01",
  "name": "AMAZON.COM",
  "merchant_name": "Amazon",
  "plaid_category_primary": "SHOPPING",
  "plaid_category_detailed": "SHOPPING_GENERAL_MERCHANDISE",
  "category_id": 12,
  "payment_channel": "online",
  "pending": false,
  "logo_url": "https://...",
  "iso_currency_code": "USD",
  "created_at": "2025-06-01T12:00:00"
}
```

---

### `POST /api/plaid/transactions/sync`
Pull recent transactions from Plaid.

**Request:**
```json
{ "plaid_item_id": 1, "days_back": 30 }
```

`days_back` range: 1–365.

**Response `200`:**
```json
{ "added": 12, "updated": 3 }
```

---

### `PUT /api/plaid/transactions/{tx_id}/category`
Manually assign a category to a transaction.

**Request:**
```json
{ "category_id": 12 }
```

---

### `GET /api/plaid/blame`
Spending breakdown by category and account for a rolling window.

**Query params:**
- `days_back` (int, default 30)

**Response `200`:**
```json
{
  "period_start": "2025-05-02",
  "period_end": "2025-06-01",
  "total_spending": 1842.50,
  "by_category": [
    { "category": "FOOD_AND_DRINK", "amount": 420.00, "count": 18, "pct": 22.8 }
  ],
  "by_account": [
    { "account_name": "Checking (···1234)", "amount": 1842.50, "pct": 100.0 }
  ]
}
```

Only positive-amount transactions (debits/spending) are included. Negative amounts (credits, refunds, deposits) are excluded.

---

## Categories

### `GET /api/categories`
List all transaction categories.

---

## Credentials

### `GET /api/credentials/by-bill/{bill_id}`
Retrieve decrypted credentials for a bill by bill ID. Returns `404` if no credential is stored for that bill. Requires auth.

**Response `200`:**
```json
{
  "id": 1,
  "bill_id": 3,
  "username": "user@example.com",
  "password": "hunter2",
  "notes": null
}
```

### `GET /api/credentials/{credential_id}`
Retrieve a credential by its own ID.

### `GET /api/credentials/`
List all credentials (decrypted).

### `POST /api/credentials`
Store credentials for a bill. Encrypted before write.

**Request:**
```json
{
  "bill_id": 3,
  "username": "user@example.com",
  "password": "hunter2",
  "notes": null
}
```

**Response `201`:** Created credential (same shape as GET response above).
**Response `404`:** Bill not found.

### `PUT /api/credentials/{credential_id}`
Update credentials. Re-encrypted on write.

### `DELETE /api/credentials/{credential_id}`
Delete credentials.

---

## Payment Methods

### `GET /api/payment-methods/`
List all saved payment methods.

**Response `200`:**
```json
[
  {
    "id": 1,
    "nickname": "Visa ···4242",
    "payment_type": "credit_card",
    "last_four": "4242",
    "expiration_date": "12/27",
    "notes": null,
    "created_at": "2025-06-01T00:00:00",
    "updated_at": "2025-06-01T00:00:00"
  }
]
```

---

### `GET /api/payment-methods/{id}`
Get a single payment method by ID.

---

### `POST /api/payment-methods/`
Create a payment method.

**Request:**
```json
{
  "nickname": "Visa ···4242",
  "payment_type": "credit_card",
  "last_four": "4242",
  "expiration_date": "12/27",
  "notes": null
}
```

`payment_type` must be one of: `credit_card`, `debit_card`, `bank_account`.
`last_four` must be exactly 4 digits.

**Response `201`:** Created payment method.

---

### `PUT /api/payment-methods/{id}`
Update a payment method. All fields optional.

---

### `DELETE /api/payment-methods/{id}`
Delete a payment method.

**Response `204`:** Deleted.
**Response `404`:** Not found.

---

## Error responses

| Status | Meaning |
|---|---|
| `400` | Bad request — malformed input |
| `401` | Unauthorized — missing or invalid JWT |
| `404` | Not found |
| `409` | Conflict — e.g. institution already connected |
| `503` | Service unavailable — Plaid credentials not configured or Plaid API unreachable |
