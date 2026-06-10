# Troubleshooting

## Installer issues

### Backend won't start after installation — "SQUEEZYPAY_ENCRYPTION_KEY must be set"

The installer generates and writes this key to `HKCU\Environment` automatically. If it's missing:

1. **Log off and log back in.** User environment variables written to `HKCU\Environment` do not take effect in sessions that were open when the installer ran.
2. Verify the key exists:
   ```powershell
   [System.Environment]::GetEnvironmentVariable("SQUEEZYPAY_ENCRYPTION_KEY", "User")
   ```
   If this returns nothing, key generation failed during installation. Regenerate manually:
   ```powershell
   cd "C:\Program Files\SqueezyPay"
   .\backend.exe --generate-key fernet "$env:TEMP\enc.key"
   $key = Get-Content "$env:TEMP\enc.key"
   [System.Environment]::SetEnvironmentVariable("SQUEEZYPAY_ENCRYPTION_KEY", $key, "User")
   Remove-Item "$env:TEMP\enc.key"
   ```

### Installer completed but SqueezyPay won't open / shows an error page

1. Check the key is set (see above).
2. Open Task Manager and look for `backend.exe`. If it is not running, launch it from the Start menu shortcut or the desktop shortcut.
3. Check for errors at `%APPDATA%\SqueezyPay\logs\`.

---

## Backend won't start

### "SQUEEZYPAY_ENCRYPTION_KEY must be set"

The encryption key is missing from the environment.

1. Check the variable exists: `$env:SQUEEZYPAY_ENCRYPTION_KEY` in PowerShell. If it's empty, the key is not set.
2. Open **System Properties → Environment Variables → User variables** and verify `SQUEEZYPAY_ENCRYPTION_KEY` is present.
3. Open a **new** terminal window and try again. Environment variable changes are not visible to already-running terminals.

**Installed app:** See the "Installer issues" section above.

**Dev setup:** Generate a key manually:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts/generate_key.py
```

---

### "alembic.util.exc.CommandError: Can't locate revision..."

The database exists but is at a different schema version than the migration history expects. This can happen after pulling changes that add migrations.

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic upgrade head
```

If that fails, check `alembic current` to see what version the database is at, and `alembic history` to see the full chain.

In development, it is acceptable to delete the database and start fresh:
```powershell
del squeezypay.db
alembic upgrade head
```

---

### Backend starts but crashes immediately with a cryptography error

The encryption key stored in the environment does not match the one used to encrypt data in the database. This is not recoverable — you cannot decrypt data encrypted with a different key.

If you are doing initial setup and the database is empty, delete it (`del backend/squeezypay.db`) and run `alembic upgrade head` again. The new database will use the current key.

---

## Frontend won't start

### "EADDRINUSE: address already in use 5173"

Another Vite process is already running on port 5173.

```powershell
# Find the process
netstat -ano | findstr :5173

# Kill it (replace <PID> with the number found above)
taskkill /PID <PID> /F
```

---

### Vite dev server starts but shows a blank page

Check the browser console for errors. Common causes:

- **401 Unauthorized**: You are not logged in. Navigate to the login page.
- **Failed to fetch `/api/...`**: The backend is not running. Start it: `cd backend && python main.py`.
- **React render error**: Check the console stack trace and the specific component.

---

## Plaid issues

### "SQUEEZYPAY_PLAID_CLIENTID and SQUEEZYPAY_PLAID_SECRET must be set"

Plaid credentials are not in the environment. See [configuration.md](configuration.md#plaid) for how to set them, then open a new terminal.

---

### Plaid Link opens but shows no institutions / "Something went wrong"

Verify you are in the correct environment. If `SQUEEZYPAY_PLAID_ENV` is `production` but your credentials are sandbox keys (or vice versa), Plaid will reject the link token.

Check: `$env:SQUEEZYPAY_PLAID_ENV` should match the type of keys in `$env:SQUEEZYPAY_PLAID_SECRET`.

---

### "A financial institution is already connected" (HTTP 409)

The single-institution constraint is enforced at the backend. Only one Plaid item is allowed at a time.

To connect a different institution: go to **Accounts → Disconnect** the current institution, then connect the new one.

---

### Browser console: "link-initialize.js embedded more than once"

Two `PlaidLinkButton` components are mounted simultaneously. This should not happen in normal operation — `Accounts.tsx` is structured to prevent it.

If you see this after modifying `Accounts.tsx` or adding `PlaidLinkButton` elsewhere, ensure there is never more than one `PlaidLinkButton` in the React tree at a time.

---

### Sync Balances / Sync Transactions returns 503

The backend cannot reach the Plaid API. Check:
1. Your machine has internet access.
2. Plaid's status page (status.plaid.com) shows no active incidents.
3. Your Plaid credentials haven't expired or been revoked.

---

## Authentication issues

### "Invalid passphrase" on login

If you forgot your passphrase, reset it from the **Settings → Security** tab in the app while you still have a valid session on another device, or use the passphrase change endpoint directly.

If you are completely locked out, reset via the database:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -c "
import bcrypt
from database.db import SessionLocal
from models.models import AuthConfig
db = SessionLocal()
cfg = db.query(AuthConfig).first()
cfg.passphrase_hash = bcrypt.hashpw(b'your-new-passphrase', bcrypt.gensalt()).decode()
db.commit()
db.close()
print('Passphrase reset.')
"
```

---

### JWT token expired / constantly getting logged out

The default session length is 24 hours. If you need a longer session, set `SQUEEZYPAY_JWT_EXPIRE_MINUTES` to a higher value (e.g., `10080` for 7 days).

---

## Database issues

### Database is locked

Another process has an open write transaction on `squeezypay.db`. Common causes: a stuck backend process, or an open database browser tool.

1. Stop the backend.
2. Close any database browser tools (DB Browser for SQLite, etc.).
3. Restart the backend.

SQLite's write lock is exclusive. Only one writer at a time is allowed.

---

### Database file is too large

Transactions accumulate over time. If the file grows unexpectedly, check for a sync loop or duplicate syncs.

To reclaim space after deleting old records:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -c "
from sqlalchemy import text
from database.db import engine
with engine.connect() as conn:
    conn.execute(text('VACUUM'))
print('VACUUM complete.')
"
```

---

## Biller autofill

### Autofill opens a new window instead of a tab

This is a known Playwright limitation. Playwright always launches a new browser window. It cannot open a tab in an existing browser window without a browser extension acting as a bridge. There is no workaround within the current architecture.

---

### Autofill doesn't fill the fields

The selector list used by `autofill_worker.py` covers the most common field patterns, but some biller sites use unusual markup.

Use the diagnostic tool to see which selectors matched:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts/diagnose_autofill.py https://billersite.example.com/login
```

The tool reports:
- Which username/email selectors matched and their element details
- Which password selectors matched
- Whether the page required a network-idle wait

If the correct fields are not in the list, a new selector can be added to the prioritized list at the top of `backend/scripts/autofill_worker.py`.

---

### Autofill button stays "Opening…" indefinitely

The frontend sets a 12-second timeout on the autofill request. If the backend worker takes longer than 12 s to navigate and fill fields, the request times out on the client side. This can happen on slow biller sites.

Check the backend logs for `autofill:` entries to see whether the worker completed, errored, or is still running. If the worker launched successfully, the browser may still be open even though the button timed out.

---

## Admin log viewer

### I can't see INFO logs in the activity panel

The log viewer opens with the **Errors & Warnings** preset active, which shows only WARN and ERROR entries. Click the **All** preset chip to see all log levels including INFO.

### I want to filter to a specific area of the app

Use one of the named presets:
- **API Traffic** — shows only REQ and RES entries (all HTTP traffic)
- **Billing** — shows any log entry whose message or service name contains billing-related keywords
- **Auth** — shows any log entry related to authentication events
- **All** — no filtering, full firehose

For custom combinations, click the **Custom** button to open the level checkbox drawer. Ticking any checkbox deactivates the active preset and puts you in manual mode.

---

## CI failures

### ruff check fails

Run `ruff check .` locally from `backend/` to see the violations, then fix them. For auto-fixable issues: `ruff check . --fix`.

### pytest coverage below threshold

Check `pytest --cov=. --cov-report=term-missing` output to see which lines are uncovered. Add tests for the new code.

### npm run lint fails

Run `npm run lint` locally from `frontend/` to see the errors. The most common issue is an unused import or a type assertion that ESLint flags.
