# Getting Started

SqueezyPay installs like any other Windows program. Download the installer, run it, and follow the wizard — it handles everything.

---

## Step 1 — Download the installer

Go to the [Releases page](https://github.com/squeezy102/SqueezyPay/releases) and download the latest `SqueezyPay-Setup.exe`.

> If you see a SmartScreen warning ("Windows protected your PC"), click **More info** then **Run anyway**. This appears because SqueezyPay is not yet code-signed. It is safe to proceed.

---

## Step 2 — Run the installer

Double-click `SqueezyPay-Setup.exe`. The wizard will walk you through:

1. **Choose install type** — Full (recommended, includes biller autofill) or Core only (smaller download, no autofill)
2. **Security setup** — the installer automatically generates your encryption key and stores it on your PC. You do not need to write anything down or enter anything here
3. **Bank integration (optional)** — if you have a [Plaid developer account](https://dashboard.plaid.com), enter your credentials here. You can skip this and add them later from Settings
4. **Set your passphrase** — choose a passphrase everyone in your household will use to log in
5. **Options** — choose whether to create a desktop shortcut and whether to start SqueezyPay automatically when Windows starts (recommended)

Click **Install**. The installer sets up the database and configures everything automatically.

---

## Step 3 — Launch SqueezyPay

If you kept the **"Launch SqueezyPay now"** checkbox checked at the end of the installer, the app will open in your browser automatically.

Otherwise, double-click the **SqueezyPay** shortcut on your desktop, or find it in the Start menu.

SqueezyPay runs as a small icon in your **system tray** — the row of icons in the bottom-right corner of your screen near the clock. Right-click the icon to start/stop services, open the app, or open the admin dashboard.

---

## Step 4 — Connect your bank (optional)

If you entered Plaid credentials during installation:

1. In the app, click **Accounts** in the left sidebar
2. Click **Connect Bank**
3. Search for your bank and log in through the secure Plaid window
4. After connecting, click **Sync Balances** and **Sync Transactions**

If you skipped Plaid during installation, you can add your credentials later under **Settings → Bank Integration**.

---

## Step 5 — Access from your phone or other devices

SqueezyPay works on any device connected to your home Wi-Fi — phones, tablets, other PCs — without installing anything on those devices.

**Find your PC's IP address:**
1. Press the **Windows key**, type `cmd`, and press **Enter**
2. In the black window that opens, type `ipconfig` and press **Enter**
3. Look for **IPv4 Address** under your active network adapter (usually "Wi-Fi" or "Ethernet")
4. It will look something like `192.168.1.15`

On any device on the same Wi-Fi, open a browser and go to:
```
http://192.168.1.15:8000
```
(replace `192.168.1.15` with your actual IP)

**Add to your phone's home screen:**
- **iPhone/iPad:** Open in Safari → tap the Share icon → **Add to Home Screen**
- **Android:** Open in Chrome → tap the three-dot menu → **Install app** or **Add to Home Screen**

The app will open in full screen like a native app.

---

## That's it

From here:
- [Configuration](Configuration) — environment variables and advanced settings
- [Deployment](Deployment) — more about the admin dashboard and network setup
- [Troubleshooting](Troubleshooting) — if something is not working

---

## Upgrading

Download the new `SqueezyPay-Setup.exe` from the [Releases page](https://github.com/squeezy102/SqueezyPay/releases) and run it. The installer upgrades in place — your data, passphrase, and settings are preserved.

> **Before upgrading:** back up your database file. It lives at `%APPDATA%\SqueezyPay\squeezypay.db`. Copy that file somewhere safe before running the new installer.

---

## Uninstalling

Open **Settings → Apps** (Windows 11) or **Control Panel → Programs and Features** (Windows 10), find **SqueezyPay**, and click **Uninstall**.

Your database and data files in `%APPDATA%\SqueezyPay\` are **not** deleted by the uninstaller — remove that folder manually if you want a clean removal.

---

## Running from source

Use this if the installer is unavailable, you prefer the command line, or you are working on the code itself.

You will need Python 3.11+, Node.js 18 LTS, and Git installed.

```powershell
git clone https://github.com/squeezy102/SqueezyPay.git
cd SqueezyPay
```

**Using the setup script**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Installs all backend and frontend dependencies and initialises the database in one step.

**If you prefer to run each step manually**

<details>
<summary>Expand manual steps</summary>

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
cd ..\frontend
npm install
```

</details>

After setup, generate and store your environment variables (see [Configuration](Configuration)), then create a desktop shortcut and launch:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-shortcut.ps1
.\scripts\launch-tray.ps1
```
