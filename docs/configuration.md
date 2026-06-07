# Configuration

SqueezyPay is configured entirely through Windows User environment variables (stored in `HKCU\Environment`). No `.env` file is committed or required.

## Why environment variables

Credentials and encryption keys must never appear in source code or config files that could end up in version control. Windows User environment variables are per-user, survive reboots, and are not visible to other users on the machine.

The backend reads variables from both the process environment (`os.environ`) and directly from the registry (`HKCU\Environment`). This means you can update a variable and see the change take effect on the next API call without restarting the backend process.

## Setting environment variables

**PowerShell (permanent, User scope):**
```powershell
[System.Environment]::SetEnvironmentVariable("VARIABLE_NAME", "value", "User")
```

**GUI:** System Properties → Advanced → Environment Variables → User variables → New.

After setting a variable, open a new terminal window to pick it up in `os.environ`.

## Variable reference

### Encryption

| Variable | Required | Default | Description |
|---|---|---|---|
| `SQUEEZYPAY_ENCRYPTION_KEY` | Yes | — | Fernet key for encrypting biller passwords and Plaid access tokens. Generate with `python backend/scripts/generate_key.py`. |

The key is a base64-encoded 32-byte value. It must be generated once and stored permanently. **If the key is lost, all encrypted data is unrecoverable.** Back it up outside the machine.

To generate a key:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts/generate_key.py
```

### Plaid

| Variable | Required | Default | Description |
|---|---|---|---|
| `SQUEEZYPAY_PLAID_CLIENTID` | For Plaid features | — | Client ID from your Plaid developer dashboard. |
| `SQUEEZYPAY_PLAID_SECRET` | For Plaid features | — | Secret from your Plaid developer dashboard. |
| `SQUEEZYPAY_PLAID_ENV` | No | `sandbox` | `sandbox` or `production`. Use `sandbox` for development. |

Obtain Plaid credentials from [dashboard.plaid.com](https://dashboard.plaid.com/). The free developer tier supports up to 10 connected items and is sufficient for household use.

If Plaid credentials are not set, the app starts normally but the Accounts tab shows an error when you attempt to connect a bank.

### Backend server

| Variable | Required | Default | Description |
|---|---|---|---|
| `SQUEEZYPAY_HOST` | No | `0.0.0.0` | Host the backend binds to. `0.0.0.0` makes it reachable on the local network. |
| `SQUEEZYPAY_PORT` | No | `8000` | Port the backend listens on. |

### JWT authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `SQUEEZYPAY_SECRET_KEY` | Yes | — | Secret used to sign JWT session tokens. Generate a random string (minimum 32 characters). |
| `SQUEEZYPAY_JWT_EXPIRE_MINUTES` | No | `1440` | Session token lifetime in minutes (default: 24 hours). |

To generate a secret key:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

## In-app settings

Some preferences are stored in the database via `PUT /api/settings`:

- **`due_soon_days`** — how many days before due date a bill is flagged as "due soon" (default: 7)
- **`large_payment_threshold`** — payments above this amount are highlighted in payment history (default: 500.0)

The household passphrase is managed via **Settings → Security** in the app (`POST /api/settings/change-passphrase`). Bills, income streams, and credentials are managed through their own tabs and API routes — not through the settings endpoint.

These are not environment variables — they persist across restarts in the SQLite database.

## Plaid sandbox vs. production

| Mode | Use case | Data |
|---|---|---|
| `sandbox` | Development and testing | Synthetic banks with fake data |
| `production` | Live household use | Real financial institutions |

When switching from `sandbox` to `production`, disconnect the existing sandbox institution from the Accounts tab first, then update `SQUEEZYPAY_PLAID_ENV` and reconnect.

Never use production credentials in a shared or forked repository.
