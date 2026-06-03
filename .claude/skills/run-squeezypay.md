# run-squeezypay

Launch primitive for SqueezyPay. Ensures backend and frontend are running before
any skill that needs a live app.

## What this skill does

Checks whether the backend (port 8000) and frontend (port 5173) are already up.
Starts any service that isn't running. Returns the URLs once both are reachable.

## Services

| Service  | Port | Start command |
|----------|------|---------------|
| Backend  | 8000 | `cd C:\SqueezyPay\backend && .\venv\Scripts\python.exe main.py` |
| Frontend | 5173 | `cd C:\SqueezyPay\frontend && npm run dev` |

## Steps

1. Check backend: `curl -s http://localhost:8000/health` — expect `{"status":"ok"}`
2. Check frontend: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` — expect `200`
3. If either is down, start it in the background via PowerShell and poll until it responds
   (max 30s, 2s intervals). Report clearly if a service fails to come up.
4. Once both are up, report:
   - App: http://localhost:5173
   - Backend API: http://localhost:8000
   - API docs: http://localhost:8000/docs

## Notes

- Backend requires `SQUEEZYPAY_ENCRYPTION_KEY` and `SQUEEZYPAY_SECRET_KEY` in the
  Windows user environment. If the backend fails to start, check those vars first.
- Frontend `npm run dev` uses Vite — it is ready when the port responds 200, not
  just when the process starts.
- Do NOT start the admin dashboard (port 9000) unless explicitly asked — it is not
  needed for app verification.
