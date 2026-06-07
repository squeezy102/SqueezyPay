# Getting Started

This guide walks through installing SqueezyPay on a Windows PC and making it accessible to other devices on your home network.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11 or later | [python.org](https://python.org) |
| Node.js | 18 LTS or later | [nodejs.org](https://nodejs.org) |
| Git | Any recent version | [git-scm.com](https://git-scm.com) |
| Plaid developer account | — | Optional; required for bank integration |

## 1. Clone the repository

```
git clone https://github.com/your-username/squeezypay.git
cd squeezypay
```

## 2. Generate your encryption key

SqueezyPay encrypts all stored credentials and Plaid access tokens using a Fernet key that lives only on your machine.

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts/generate_key.py
```

The script prints a key and instructions for storing it as a Windows User environment variable. Follow those instructions exactly.

**If this key is lost, all encrypted data becomes unrecoverable.** Write it down or store it in a password manager before continuing.

## 3. Set environment variables

Open **System Properties → Environment Variables → User variables** and add:

| Variable | Value |
|---|---|
| `SQUEEZYPAY_ENCRYPTION_KEY` | The key generated in step 2 |
| `SQUEEZYPAY_SECRET_KEY` | A random 32+ character string for signing JWT tokens. Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SQUEEZYPAY_PLAID_CLIENTID` | Your Plaid client ID (optional) |
| `SQUEEZYPAY_PLAID_SECRET` | Your Plaid secret (optional) |
| `SQUEEZYPAY_PLAID_ENV` | `sandbox` or `production` (optional, defaults to `sandbox`) |

After adding variables, open a new terminal window — changes to User environment variables are not visible in already-running terminals.

For full variable reference see [configuration.md](configuration.md).

## 4. Install backend dependencies

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 5. Run database migrations

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic upgrade head
```

This creates `backend/squeezypay.db` with the full schema.

## 6. Install frontend dependencies

```powershell
cd frontend
npm install
```

## 7. Start the app

Start the admin dashboard — it manages all other services and runs without a console window:

```powershell
pythonw admin\launch.pyw
```

This opens **http://localhost:9000** automatically. Click **Start & Launch** to start the backend and frontend and open the app. Running the launcher again when the admin is already running just re-focuses the browser tab — no duplicate processes.

## 8. Connect your bank (optional)

If you set Plaid credentials in step 3:

1. Navigate to **Accounts** in the sidebar.
2. Click **Connect Bank**.
3. Complete the Plaid Link flow — search for your institution and log in.
4. After connecting, click **Sync Balances** and **Sync Transactions** to pull your data.

If you are using `sandbox` mode, Plaid provides synthetic test institutions. Use the institution "First Platypus Bank" with credentials `user_good` / `pass_good`.

## 9. Access from other devices

Find your PC's local IP address:
```
ipconfig
```
Look for **IPv4 Address** under your active network adapter (usually something like `192.168.1.x`).

On any device on the same Wi-Fi network, navigate to:
```
http://<your-ip>:5173
```

To install as a home screen app:
- **iPhone:** Safari → Share → "Add to Home Screen"
- **Android:** Chrome → menu → "Install app"

## Next steps

- [Configuration](configuration.md) — review all available settings
- [Deployment](deployment.md) — use the admin dashboard to start/stop services without a terminal
- [Troubleshooting](troubleshooting.md) — common setup issues
