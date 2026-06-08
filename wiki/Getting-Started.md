# Getting Started

This guide walks you through setting up SqueezyPay on a Windows PC. You do not need to be a programmer to follow it. Each step explains what you are doing and why before telling you how.

---

## What you will need

Before you start, install these three programs. All are free.

**Python 3.11 or later**
Python is the programming language the app's backend is written in. The installer does the hard work.
1. Go to [python.org/downloads](https://www.python.org/downloads/)
2. Click the big yellow **Download Python** button
3. Run the installer. **Important:** on the first screen, check the box that says **"Add Python to PATH"** before clicking Install

**Node.js 18 LTS or later**
Node.js runs the app's frontend interface.
1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the left button)
3. Run the installer with all default settings

**Git**
Git is used to download the SqueezyPay code.
1. Go to [git-scm.com/downloads](https://git-scm.com/downloads)
2. Click **Windows**
3. Run the installer with all default settings

After installing all three, restart your computer before continuing.

---

## Step 1 — Download SqueezyPay

You will use a program called **PowerShell** to download the code. PowerShell is built into Windows — you do not need to install it.

**How to open PowerShell:**
- Press the **Windows key**, type `PowerShell`, and press **Enter**
- A blue window with white text will appear. This is where you type commands.

**How to run a command:**
- Click inside the blue window
- Type (or copy and paste) the command exactly as shown
- Press **Enter**

Run this command to download SqueezyPay to your computer. It will create a `SqueezyPay` folder wherever your PowerShell window is currently pointing (usually your user folder):

```
git clone https://github.com/squeezy102/SqueezyPay.git
```

Then move into the folder:

```
cd SqueezyPay
```

Keep this PowerShell window open — you will use it for the next few steps.

---

## Step 2 — Run the setup script

SqueezyPay includes a setup script that handles the technical installation steps for you: creating the Python environment, installing dependencies, and setting up the database.

In the same PowerShell window, run:

```
.\scripts\setup.ps1
```

**If you see an error about "execution policy":**
PowerShell has a safety setting that can block scripts from running. To allow it just for this command, run this instead:

```
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

The setup script will print its progress. It may take a few minutes the first time. When it finishes, it will tell you what to do next.

> **If there is no setup.ps1 yet:** Follow the [Manual Setup](#manual-setup) steps at the bottom of this page instead, then come back here.

---

## Step 3 — Generate your security keys

SqueezyPay needs two security keys that live only on your computer:

- **Encryption key** — scrambles your stored passwords and bank tokens so they cannot be read if someone gets your database file
- **Secret key** — signs your login sessions so the app knows you are who you say you are

**These keys are never sent anywhere.** They stay on your PC.

Run the key generator:

```
cd backend
.\venv\Scripts\python.exe scripts\generate_key.py
```

The script will print something like:

```
Your encryption key:
  z3Rm8...long string of characters...

Store this as a Windows environment variable named SQUEEZYPAY_ENCRYPTION_KEY.
```

You will need to store this key (and one more) as **environment variables** in Step 4. Do not close this window yet.

> **Important:** This key cannot be recovered if lost. Before moving on, copy the key and save it somewhere safe — a password manager, a printed note in a secure place, or a USB drive you keep offline. If the key is lost, all your encrypted data becomes unrecoverable.

---

## Step 4 — Store your keys as environment variables

An **environment variable** is a named value stored in Windows that programs can read. Think of it like a setting that lives in the operating system rather than inside a file. SqueezyPay reads its keys from here so they never have to be written into any code or config file.

### How to open Environment Variables

1. Press the **Windows key**, type `environment variables`, and press **Enter**
2. Click **"Edit the system environment variables"**
3. In the window that opens, click the **"Environment Variables..."** button near the bottom
4. You will see two sections: **"User variables for [your name]"** (top) and System variables (bottom). You are adding to the **User variables** section.

### Adding a variable

1. Click **New...** under the User variables section
2. In **Variable name**, type the name exactly as shown
3. In **Variable value**, paste the value
4. Click **OK**

Repeat this for each variable below.

### Variables to add

**Variable 1 — Encryption key**

| Field | Value |
|---|---|
| Variable name | `SQUEEZYPAY_ENCRYPTION_KEY` |
| Variable value | The key printed by `generate_key.py` in Step 3 |

**Variable 2 — Secret key**

This one you generate yourself. Go back to your PowerShell window and run:

```
.\venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

It prints a string of random characters. Copy that string.

| Field | Value |
|---|---|
| Variable name | `SQUEEZYPAY_SECRET_KEY` |
| Variable value | The string you just generated |

**Variable 3 — Plaid (optional, skip if you are not connecting a bank)**

If you have a Plaid developer account and want to connect your real bank accounts, add these too. If you are just trying SqueezyPay out or only want to track bills manually, skip these for now — you can add them later.

| Variable name | Variable value |
|---|---|
| `SQUEEZYPAY_PLAID_CLIENTID` | Your Client ID from [dashboard.plaid.com](https://dashboard.plaid.com) |
| `SQUEEZYPAY_PLAID_SECRET` | Your Secret from the Plaid dashboard |
| `SQUEEZYPAY_PLAID_ENV` | `sandbox` (for testing) or `production` (for real accounts) |

### After adding variables

Click **OK** on each window to close them. Then **close your PowerShell window and open a new one**. Environment variable changes do not take effect in windows that were already open.

Open a new PowerShell window and navigate back to your SqueezyPay folder:

```
cd SqueezyPay
```

(If PowerShell opens in a different folder, you may need to type the full path, such as `cd C:\Users\YourName\SqueezyPay`)

---

## Step 5 — Create a desktop shortcut

SqueezyPay uses a system tray icon to manage all its services in the background — similar to how antivirus software or OneDrive runs quietly in your taskbar. You launch it from a shortcut just like any other program.

Run this once to create the shortcut on your desktop:

```
powershell -ExecutionPolicy Bypass -File .\scripts\create-shortcut.ps1
```

A **SqueezyPay** shortcut will appear on your desktop.

---

## Step 6 — Start SqueezyPay

Double-click the **SqueezyPay** shortcut on your desktop.

A small icon will appear in your **system tray** — the row of small icons in the bottom-right corner of your screen, near the clock. You may need to click the **^** arrow to see it if it is hidden.

**Right-click the tray icon** to see your options:
- **Start All** — starts the backend and frontend
- **Stop All** — shuts everything down
- **Open App** — opens SqueezyPay in your browser
- **Open Dashboard** — opens the admin panel for service management and logs

Click **Start All**, then click **Open App**. SqueezyPay will open in your browser.

The first time you open it, you will be asked to create a household passphrase. This is the password everyone in your household uses to log in.

---

## Step 7 — Start automatically on login (optional but recommended)

So you do not have to double-click the shortcut every time your PC restarts, you can set SqueezyPay to start automatically when you log in.

Open PowerShell **as Administrator** (right-click PowerShell in the Start menu and choose **Run as administrator**), navigate to your SqueezyPay folder, and run:

```
.\scripts\register-autostart.ps1
```

SqueezyPay will now start silently in the background every time you log in to Windows.

---

## Step 8 — Connect your bank (optional)

If you added Plaid credentials in Step 4:

1. In the app, click **Accounts** in the left sidebar
2. Click **Connect Bank**
3. Search for your bank in the Plaid window and log in
4. After connecting, click **Sync Balances** and **Sync Transactions** to pull your data

If you are using `sandbox` mode (testing with fake data), use the institution called **"First Platypus Bank"** with username `user_good` and password `pass_good`.

---

## Step 9 — Access from your phone or other devices

SqueezyPay is designed to work on any device in your home — phones, tablets, other PCs — without installing anything on those devices.

**Find your PC's IP address:**
1. Open PowerShell and run: `ipconfig`
2. Look for **IPv4 Address** under your active network adapter (usually named "Wi-Fi" or "Ethernet")
3. It will look something like `192.168.1.15`

On any device connected to the same Wi-Fi, open a browser and go to:
```
http://192.168.1.15:5173
```
(replace `192.168.1.15` with your actual IP)

**To install as a home screen app:**
- **iPhone/iPad:** Open in Safari → tap the Share icon (box with arrow) → tap **"Add to Home Screen"**
- **Android:** Open in Chrome → tap the three-dot menu → tap **"Install app"** or **"Add to Home Screen"**

The app will open in full screen like a native app.

---

## You are set up

From here:
- [Configuration](Configuration) — all available settings explained
- [Troubleshooting](Troubleshooting) — if something is not working
- [Deployment](Deployment) — more about the admin dashboard and network setup

---

## Manual setup

Use this section only if the setup script in Step 2 did not work, or if you prefer to run each step yourself.

<details>
<summary>Click to expand manual setup steps</summary>

### M1 — Create the Python environment

Open PowerShell, navigate to your SqueezyPay folder, and run:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

This creates an isolated Python environment in `backend\venv\` so SqueezyPay's dependencies do not interfere with anything else on your system.

### M2 — Run database migrations

```powershell
alembic upgrade head
```

This creates the database file at `backend\squeezypay.db`.

### M3 — Install frontend dependencies

```powershell
cd ..\frontend
npm install
```

### M4 — Complete setup

After these steps, return to [Step 3](#step-3--generate-your-security-keys) above and continue from there.

</details>
