# SqueezyPay

A private household bill management and personal finance dashboard. Self-hosted on your home network - accessible from any device in the house.

**The problem it solves:** Managing household finances is fragmented. Credentials are scattered. Paying a bill means hunting down URLs and navigating forgot-password flows. There is no single place to see the full picture, track spending, or have an honest conversation about where the money is going.

SqueezyPay is the single source of truth for household finances. Every bill, every credential, every payment record, every transaction - all in one place, on your own hardware, accessible from any browser on your home network.

---

## What It Does

**Currently live:**

- **Bill dashboard** - all household bills at a glance, sorted by due date, with overdue and due-soon status badges
- **One-click navigation** - open any biller's payment page directly from the dashboard
- **Secure credential vault** - encrypted storage for biller usernames and passwords
- **Payment method storage** - encrypted storage for cards and bank accounts
- **Dark mode** - defaults to system preference, persists per device
- **PWA** - installs as a home screen app on iPhone and Android

**Planned** (see [ROADMAP.md](docs/ai-assistant/ROADMAP.md)):

- Payment history log with confirmation numbers
- Bill management UI (add, edit, deactivate)
- Example Credit Union integration via Plaid
- Blame graph - spending breakdown by card and category
- Budget tracking and spending projections
- Net worth snapshot
- Income tracking

---

## Prerequisites

| Tool | Purpose |
|---|---|
| [Git](https://git-scm.com) | Version control |
| [Node.js LTS](https://nodejs.org) | React frontend |
| [Python 3.11+](https://python.org) | FastAPI backend |

---

## Setup

### 1. Clone the repository

```
git clone https://github.com/squeezy102/SqueezyPay.git
cd SqueezyPay
```

### 2. Generate your encryption key

The encryption key protects all stored credentials and payment methods. Generate it once and store it as a Windows environment variable:

```
python scripts/generate_key.py
```

Follow the instructions the script prints. **If this key is lost, encrypted data cannot be recovered.**

### 3. Set up environment variables

```
cp .env.example .env
```

Fill in the values in `.env`. This file is gitignored - never commit it.

### 4. Install dependencies

**Frontend:**
```
cd frontend
npm install
```

**Backend:**
```
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1    # Windows
# source venv/bin/activate      # Mac/Linux
pip install -r requirements.txt
```

**Admin dashboard:**
```
cd admin
pip install -r requirements.txt
```

### 5. Seed the database

On a fresh install, seed the database with the initial bill list:

```
cd backend
python seed.py
```

---

## Running the App

### Preferred: Admin dashboard

Run `scripts/launch-admin.ps1` or double-click the "SqueezyPay Admin" desktop shortcut (created by `scripts/create-shortcut.ps1`).

The admin server starts and opens your browser at `http://localhost:9000`. Use the **Start** buttons there to bring up the backend and frontend.

### Manual fallback

```powershell
# Terminal 1 - Backend (from /backend)
.\venv\Scripts\Activate.ps1
python main.py

# Terminal 2 - Frontend (from /frontend)
npm run dev

# Optional: Terminal 3 - Admin dashboard (from /admin)
python -m uvicorn main:app --host 0.0.0.0 --port 9000
```

**URLs:**

| Service | URL |
|---|---|
| App | `http://localhost:5173` |
| Backend API | `http://localhost:8000` |
| API docs | `http://localhost:8000/docs` |
| Admin dashboard | `http://localhost:9000` |

---

## Accessing From Other Devices

Once the app is running, any device on your home network can reach it. Find your PC's local IP:

```
ipconfig    # Windows - look for "IPv4 Address"
```

Then navigate to `http://<your-ip>:5173` in any browser on the network.

**To install as a home screen app:**
- **iPhone:** Open in Safari → Share → "Add to Home Screen"
- **Android:** Open in Chrome → menu → "Install app"

---

## Project Documentation

The `docs/ai-assistant/` directory is the living documentation for this project. Reading it is the fastest way to understand what has been built, what is planned, and why decisions were made. If the docs are out of date, the project is broken - even if the code works.

| File | Contents |
|---|---|
| [CONTEXT.md](docs/ai-assistant/CONTEXT.md) | Current app state, file structure, session handoff notes |
| [REQUIREMENTS.md](docs/ai-assistant/REQUIREMENTS.md) | Feature requirements (REQ-001 through REQ-015) |
| [ROADMAP.md](docs/ai-assistant/ROADMAP.md) | Build phases and priorities |
| [DECISIONS.md](docs/ai-assistant/DECISIONS.md) | Vision, philosophy, and architecture decision log |
| [USERPREFERENCES.md](docs/ai-assistant/USERPREFERENCES.md) | Working style and AI collaboration guidelines |
| [TESTCASES.md](docs/ai-assistant/TESTCASES.md) | Manual test cases |

---

## Development

### Branching strategy

| Branch | Purpose |
|---|---|
| `master` | Stable releases only - never commit directly |
| `dev` | Active development - all PRs target this branch |
| `feature/short-description` | New features |
| `fix/short-description` | Bug fixes |
| `docs/short-description` | Documentation only |
| `chore/short-description` | Maintenance and cleanup |

### Working with Claude Code

This project is built with [Claude Code](https://claude.ai/code). Before starting any coding session, have Claude read the project docs:

> "Read the .md files in docs/ai-assistant/ before we start."

This gives Claude the context it needs to make decisions consistent with what has already been built.
