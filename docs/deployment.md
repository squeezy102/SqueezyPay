# Deployment

SqueezyPay is designed to run on a single PC on a home network and be accessible from any device (phone, tablet, another PC) on the same Wi-Fi. There is no cloud hosting, no SSL requirement, and no domain name required.

## Development vs. production mode

| Mode | Frontend | Backend |
|---|---|---|
| Development | Vite dev server on `:5173` | Uvicorn with auto-reload on `:8000` |
| Production | Static files built to `frontend/dist/`, served by backend or a separate static server | Uvicorn without auto-reload |

For household use, development mode is perfectly acceptable. The Vite dev server is fast and stable. The distinction matters more if you intend to expose the app beyond your local network (not recommended).

## Manual startup

**Terminal 1 — backend:**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

**Terminal 2 — frontend:**
```powershell
cd frontend
npm run dev
```

## Admin dashboard

The admin dashboard (`http://localhost:9000`) provides a browser-based alternative to terminal startup. It shows service status cards for the backend and frontend with start/stop buttons, and a live log viewer.

**Start the admin dashboard:**
```powershell
cd admin
python -m uvicorn main:app --host 0.0.0.0 --port 9000
```

Or run the PowerShell launcher:
```powershell
.\scripts\launch-admin.ps1
```

Or use the desktop shortcut (created by `.\scripts\create-shortcut.ps1`).

## Accessing from other devices

Find your PC's local IP:
```
ipconfig
```
Look for **IPv4 Address** under your active network adapter. It will look like `192.168.1.x` or `192.168.0.x`.

On any device on the same Wi-Fi, navigate to:
```
http://<your-ip>:5173
```

The Vite dev server is already bound to `0.0.0.0` by default, so no additional configuration is required.

## Installing as a home screen app (PWA)

SqueezyPay includes a PWA manifest. Once you have accessed it from a device's browser:

- **iPhone/iPad:** Open in Safari → Share icon → "Add to Home Screen"
- **Android:** Open in Chrome → three-dot menu → "Install app" or "Add to Home Screen"

The app opens in standalone mode (no browser chrome) and behaves like a native app.

## Auto-start on Windows login

Planned, not yet implemented. Target: a Task Scheduler entry that starts the backend and admin dashboard on user login without requiring a visible terminal. Until then, use the desktop shortcut to launch the admin dashboard, then start services from there.

## Building for production

```powershell
cd frontend
npm run build
```

This produces `frontend/dist/`. The FastAPI backend can serve these static files directly:

```python
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")
```

This allows running a single process (backend only) with no Vite server. In this configuration, the app is accessible on `:8000` only.

For household use, running both Vite and backend separately is simpler and preferred.

## Firewall

Windows Firewall may block incoming connections on ports 5173 and 8000 from other devices. If other devices on the network cannot reach the app, add inbound rules:

```powershell
# Allow Vite dev server from local network
netsh advfirewall firewall add rule name="SqueezyPay Frontend" dir=in action=allow protocol=TCP localport=5173

# Allow backend
netsh advfirewall firewall add rule name="SqueezyPay Backend" dir=in action=allow protocol=TCP localport=8000
```

## Ports summary

| Service | Default port | Configurable |
|---|---|---|
| Frontend (Vite) | 5173 | `vite.config.ts` → `server.port` |
| Backend (FastAPI) | 8000 | `SQUEEZYPAY_PORT` env var |
| Admin dashboard | 9000 | Uvicorn `--port` argument |

## Security note

This app is designed for a trusted home network. It is not hardened for exposure to the public internet. Do not forward these ports through your router's NAT to the internet. If you need remote access, use a VPN (Tailscale, WireGuard) to reach your home network, then access the app over the VPN tunnel.
