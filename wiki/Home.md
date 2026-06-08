# SqueezyPay

A self-hosted household finance app for tracking bills, logging payments, managing income streams, and visualizing spending — all on your home network, with no cloud dependency.

## Quick links

| Page | Description |
|---|---|
| [Getting Started](Getting-Started) | Install, configure, and run SqueezyPay for the first time |
| [Configuration](Configuration) | All environment variables and in-app settings |
| [Deployment](Deployment) | Running on your home network, PWA setup, autostart |
| [API Reference](API-Reference) | Full REST API documentation |
| [Architecture](Architecture) | Technical design decisions and system overview |
| [Database](Database) | Schema, migrations, and data model |
| [Frontend](Frontend) | React app structure and component guide |
| [Testing](Testing) | Running the test suite, coverage, CI |
| [Troubleshooting](Troubleshooting) | Common problems and how to fix them |
| [Roadmap](Roadmap) | Planned features, known limitations, and deferred work |

## What is SqueezyPay?

SqueezyPay is a three-tier household finance app:

- **Backend** — FastAPI + SQLite, runs on a single Windows PC
- **Frontend** — React/TypeScript, accessible from any device on the home Wi-Fi
- **Admin dashboard** — browser-based service manager for starting/stopping the app and viewing logs

It connects to real bank accounts via [Plaid](https://plaid.com) (optional), supports biller autofill via Playwright (experimental), and stores everything locally — no accounts, no subscriptions, no telemetry.

## Design constraints

- **Single household** — one set of credentials, one connected bank institution at a time
- **LAN-first** — designed for a trusted home network; not hardened for public internet exposure
- **No cloud** — all data stays on your machine; Plaid is the only external dependency and is optional
- **No hardcoded institution names** — institution data always comes from Plaid or user input

## Source

[github.com/squeezy102/SqueezyPay](https://github.com/squeezy102/SqueezyPay)
