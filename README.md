# SqueezyPay

A private household bill management and personal finance dashboard. Lives on
your home network. Accessible from any device in the house.

**The problem it solves:** Managing household finances is fragmented. Credentials
are scattered. Paying bills means hunting down URLs and navigating forgot-password
flows. There is no single place to see the full picture, track spending, or have
an honest conversation about where the money is going.

SqueezyPay is the single source of truth for household finances. Every bill,
every credential, every payment record, every transaction - all in one place,
accessible from any browser on your home network.

> [!CAUTION]
> ## DOCUMENTATION IS THE TIER 1 DELIVERABLE
>
> **Documentation > Code.** Always.
>
> The `docs/ai-assistant/` directory is the backbone of this project. It preserves
> decisions, maintains continuity across sessions, and prevents repeated mistakes.
> Without current documentation, the codebase becomes unmaintainable and fragile.
>
> - Every session must keep docs current - no exceptions
> - At the end of every session, ask: *"Is there anything we built today that
>   hasn't been documented yet?"*
> - If documentation is out of date, the project is broken - even if the code works

---

## What It Does

- **Bill dashboard** - all household bills at a glance, one-click to each
biller's payment page
- **Payment history** - log confirmation numbers and track what got paid and when
- **Secure vault** - encrypted storage for biller credentials and payment methods
- **Example Credit Union integration** - automatic transaction and balance data via Plaid
- **Blame graph** - spending breakdown by card and category; see where the money
is really going
- **Budget tracking** - monthly targets per category vs. actual spend
- **Spending projections** - forward-looking cash flow based on known bills and income
- **Net worth snapshot** - assets and liabilities in one number
- **PWA** - installs as a home screen app on iPhone

---

## How This Project Is Built

This project is built using [Claude Code](https://claude.ai/code) - Anthropic's
AI coding tool. The owner describes what they want, Claude Code writes the code,
and the owner reviews and tests the result. No manual code writing required.

The only non-negotiable is the documentation. Whatever approach you use,
`docs/ai-assistant/` must stay current.

---

## Tools You Need

| Tool | Purpose | Download |
|---|---|---|
| [Git](https://git-scm.com) | Version control | https://git-scm.com |
| [Node.js LTS](https://nodejs.org) | React frontend | https://nodejs.org |
| [Python 3.11+](https://python.org) | FastAPI backend | https://python.org |
| [VS Code](https://code.visualstudio.com) | Code editor | https://code.visualstudio.com |
| [Claude Code](https://claude.ai/code) | AI coding tool | https://claude.ai/code |

---

## Setup

### 1. Clone the repository

```
git clone https://github.com/squeezy102/SqueezyPay.git
cd SqueezyPay
```

### 2. Set up environment variables

Copy the example file and fill in your values:

```
cp .env.example .env
```

> **Never commit your `.env` file.** It is gitignored. The encryption key
> inside it protects all stored credentials and payment methods. If it is
> lost, encrypted data cannot be recovered.

### 3. Install dependencies

Frontend:
```
cd frontend
npm install
```

Backend:
```
cd backend
python -m venv venv
# On Windows: .\venv\Scripts\Activate.ps1
# On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the app

**Start the backend first** (from `/backend`):
```
# Activate virtual environment
# Windows: .\venv\Scripts\Activate.ps1
# Mac/Linux: source venv/bin/activate

python main.py
```
Backend runs on `http://localhost:8000`

**In a new terminal, start the frontend** (from `/frontend`):
```
npm run dev
```
Frontend runs on `http://localhost:5173`

The app will be accessible at:
- **Local machine:** `http://localhost:5173`
- **Other devices on home network:** `http://<your-pc-local-ip>:5173`
  - Find your PC's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

### 5. Seed the database (Phase 1+)

If it's a fresh database, seed with initial bill data:
```
cd backend
python seed.py
```

---

## Accessing From Other Devices

Once both frontend and backend are running on your PC, any device on your home network can
access SqueezyPay by navigating to your PC's local IP address in a browser.

**On iPhone:** Navigate to the app URL in Safari, tap Share → "Add to Home Screen" to install as an app.

## Development

See `docs/ai-assistant/CONTEXT.md` for detailed development notes, current phase status, and architecture decisions.

To find your PC's local IP on Windows: `Win + R` → type `cmd` → run `ipconfig`
Look for "IPv4 Address" under your active network adapter.

**On iPhone:** Navigate to the app URL in Safari, tap Share → "Add to Home Screen" to install as an app icon.

---

## Project Documentation

The `docs/ai-assistant/` directory contains the living documentation for this
project. Reading it is the fastest way to understand what has been built and
what is planned.

| File | Contents |
|---|---|
| [CONTEXT.md](docs/ai-assistant/CONTEXT.md) | Current app state, file structure, known issues |
| [REQUIREMENTS.md](docs/ai-assistant/REQUIREMENTS.md) | Feature requirements (REQ-001 through REQ-015) |
| [ROADMAP.md](docs/ai-assistant/ROADMAP.md) | Build phases with priority labels |
| [DECISIONS.md](docs/ai-assistant/DECISIONS.md) | Vision, philosophy, architecture decision log |
| [USERPREFERENCES.md](docs/ai-assistant/USERPREFERENCES.md) | Working style and AI collaboration guidelines |

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `master` | Stable releases only - never commit directly here |
| `dev` | Active development - PRs target this branch |
| `feature/short-description` | New features or enhancements |
| `fix/short-description` | Bug fixes |
| `docs/short-description` | Documentation only |
| `chore/short-description` | Maintenance and cleanup |

---

## Starting a Session with Claude Code

Before starting any coding session, make sure Claude Code has read the
project documentation:

> "Read the .md files in docs/ai-assistant/ before we start."

This gives Claude Code the context it needs to make decisions consistent
with what has already been built.
