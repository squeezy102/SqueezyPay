"""
SqueezyPay system tray icon.

Manages all three services (admin, backend, frontend) from the Windows tray.
The admin server is owned directly by this process. Backend and frontend are
delegated to the admin API so process tracking stays in one place.

Run via launch-tray.ps1 or registered as a login auto-start task.
"""

import ctypes
import os
import sys
import time
import winreg
import subprocess
import threading
import webbrowser
from pathlib import Path

import requests
import pystray
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent.parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
ADMIN_DIR = ROOT / "admin"
VENV_PYTHON = BACKEND_DIR / "venv" / "Scripts" / "python.exe"

ADMIN_PORT = 9000
ADMIN_URL = f"http://localhost:{ADMIN_PORT}"
POLL_INTERVAL = 4  # seconds between status checks

_admin_proc: subprocess.Popen | None = None
_tray: pystray.Icon | None = None
_last_status: dict = {}


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

def _load_user_env() -> dict:
    """Merge HKCU\\Environment into os.environ so child processes get user env vars."""
    env = dict(os.environ)
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            i = 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(key, i)
                    env[name] = value
                    i += 1
                except OSError:
                    break
    except OSError:
        pass
    return env


# ---------------------------------------------------------------------------
# Icon rendering
# ---------------------------------------------------------------------------

_ICON_SIZE = 64
_COLOR_ALL_UP   = (34, 197, 94)    # green-500
_COLOR_PARTIAL  = (234, 179, 8)    # yellow-500
_COLOR_ALL_DOWN = (239, 68, 68)    # red-500
_COLOR_BG       = (0, 0, 0, 0)     # transparent


def _make_icon(color: tuple) -> Image.Image:
    img = Image.new("RGBA", (_ICON_SIZE, _ICON_SIZE), _COLOR_BG)
    draw = ImageDraw.Draw(img)
    margin = 6
    draw.ellipse(
        [margin, margin, _ICON_SIZE - margin, _ICON_SIZE - margin],
        fill=color,
    )
    return img


def _status_color(status: dict) -> tuple:
    services = ["admin", "backend", "frontend"]
    up = sum(1 for s in services if status.get(s, {}).get("running", False))
    if up == len(services):
        return _COLOR_ALL_UP
    if up == 0:
        return _COLOR_ALL_DOWN
    return _COLOR_PARTIAL


# ---------------------------------------------------------------------------
# Admin server management (owned by this process)
# ---------------------------------------------------------------------------

def _admin_running() -> bool:
    global _admin_proc
    if _admin_proc and _admin_proc.poll() is None:
        return True
    try:
        r = requests.get(f"{ADMIN_URL}/api/status", timeout=1)
        return r.status_code == 200
    except Exception:
        return False


def _start_admin():
    global _admin_proc
    if _admin_running():
        return
    env = {**_load_user_env(), "PYTHONUNBUFFERED": "1"}
    _admin_proc = subprocess.Popen(
        [str(VENV_PYTHON), "-m", "uvicorn", "main:app",
         "--host", "127.0.0.1", "--port", str(ADMIN_PORT)],
        cwd=str(ADMIN_DIR),
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    # Wait up to 8 seconds for the admin server to be ready
    for _ in range(16):
        time.sleep(0.5)
        if _admin_running():
            break


def _stop_admin():
    global _admin_proc
    if _admin_proc and _admin_proc.poll() is None:
        _admin_proc.terminate()
        try:
            _admin_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _admin_proc.kill()
        _admin_proc = None
        return
    # Fallback: kill whatever is on port 9000
    import psutil
    for conn in psutil.net_connections():
        if conn.laddr.port == ADMIN_PORT and conn.status == "LISTEN" and conn.pid:
            try:
                psutil.Process(conn.pid).terminate()
            except Exception:
                pass
            break


# ---------------------------------------------------------------------------
# Backend / frontend via admin API
# ---------------------------------------------------------------------------

def _api_start(service: str):
    try:
        requests.post(f"{ADMIN_URL}/api/start/{service}", timeout=5)
    except Exception:
        pass


def _api_stop(service: str):
    try:
        requests.post(f"{ADMIN_URL}/api/stop/{service}", timeout=5)
    except Exception:
        pass


def _get_status() -> dict:
    """Return unified status dict for all three services."""
    status = {
        "admin":    {"running": False},
        "backend":  {"running": False},
        "frontend": {"running": False},
    }
    admin_up = _admin_running()
    status["admin"]["running"] = admin_up
    if admin_up:
        try:
            r = requests.get(f"{ADMIN_URL}/api/status", timeout=2)
            if r.status_code == 200:
                data = r.json()
                status["backend"]["running"]  = data.get("backend",  {}).get("running", False)
                status["frontend"]["running"] = data.get("frontend", {}).get("running", False)
        except Exception:
            pass
    return status


# ---------------------------------------------------------------------------
# Menu helpers
# ---------------------------------------------------------------------------

def _svc_label(name: str, status: dict) -> str:
    up = status.get(name, {}).get("running", False)
    indicator = "● " if up else "○ "
    return f"{indicator}{name.capitalize()}"


def _build_menu(status: dict) -> pystray.Menu:
    admin_up    = status.get("admin",    {}).get("running", False)
    backend_up  = status.get("backend",  {}).get("running", False)
    frontend_up = status.get("frontend", {}).get("running", False)
    all_up = admin_up and backend_up and frontend_up

    return pystray.Menu(
        pystray.MenuItem("SqueezyPay", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "Start All" if not all_up else "All Running",
            _on_start_all,
            enabled=not all_up,
        ),
        pystray.MenuItem(
            "Stop All",
            _on_stop_all,
            enabled=admin_up or backend_up or frontend_up,
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(_svc_label("admin",    status), _on_toggle_admin),
        pystray.MenuItem(_svc_label("backend",  status), _on_toggle_backend,  enabled=admin_up),
        pystray.MenuItem(_svc_label("frontend", status), _on_toggle_frontend, enabled=admin_up),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open Dashboard", _on_open_dashboard, enabled=admin_up),
        pystray.MenuItem("Open App",       _on_open_app,       enabled=frontend_up),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", _on_quit),
    )


# ---------------------------------------------------------------------------
# Menu actions
# ---------------------------------------------------------------------------

def _on_start_all(icon, item):
    _start_admin()
    _api_start("backend")
    _api_start("frontend")
    _refresh_icon(icon)


def _on_stop_all(icon, item):
    _api_stop("frontend")
    _api_stop("backend")
    _stop_admin()
    _refresh_icon(icon)


def _on_toggle_admin(icon, item):
    if _admin_running():
        _api_stop("frontend")
        _api_stop("backend")
        _stop_admin()
    else:
        _start_admin()
    _refresh_icon(icon)


def _on_toggle_backend(icon, item):
    if _last_status.get("backend", {}).get("running", False):
        _api_stop("backend")
    else:
        _api_start("backend")
    _refresh_icon(icon)


def _on_toggle_frontend(icon, item):
    if _last_status.get("frontend", {}).get("running", False):
        _api_stop("frontend")
    else:
        _api_start("frontend")
    _refresh_icon(icon)


def _on_open_dashboard(icon, item):
    webbrowser.open(ADMIN_URL)


def _on_open_app(icon, item):
    webbrowser.open("http://localhost:5173")


def _on_quit(icon, item):
    icon.stop()


def _status_tooltip(status: dict) -> str:
    lines = ["SqueezyPay"]
    for svc in ("admin", "backend", "frontend"):
        up = status.get(svc, {}).get("running", False)
        dot = "●" if up else "○"
        lines.append(f"  {dot} {svc.capitalize()}")
    return "\n".join(lines)


def _refresh_icon(icon: pystray.Icon):
    global _last_status
    _last_status = _get_status()
    icon.icon  = _make_icon(_status_color(_last_status))
    icon.menu  = _build_menu(_last_status)
    icon.title = _status_tooltip(_last_status)


# ---------------------------------------------------------------------------
# Background polling thread
# ---------------------------------------------------------------------------

def _poll_loop(icon: pystray.Icon):
    while True:
        time.sleep(POLL_INTERVAL)
        if not icon.visible:
            break
        _refresh_icon(icon)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    global _tray

    # Start admin server immediately on launch
    _start_admin()

    status = _get_status()
    _last_status.update(status)

    icon_image = _make_icon(_status_color(status))
    menu = _build_menu(status)

    _tray = pystray.Icon(
        name="SqueezyPay",
        icon=icon_image,
        title=_status_tooltip(status),
        menu=menu,
    )

    # Polling runs in a daemon thread; stops when the icon stops
    t = threading.Thread(target=_poll_loop, args=(_tray,), daemon=True)
    t.start()

    _tray.run()

    # On quit: stop all services cleanly
    _api_stop("frontend")
    _api_stop("backend")
    _stop_admin()


_MUTEX_NAME = "Global\\SqueezyPayTray"
_mutex_handle = None


def _acquire_single_instance() -> bool:
    """Create a named Windows mutex. Returns True if this is the first instance."""
    global _mutex_handle
    _mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, True, _MUTEX_NAME)
    # ERROR_ALREADY_EXISTS = 183
    return ctypes.windll.kernel32.GetLastError() != 183


if __name__ == "__main__":
    if not _acquire_single_instance():
        sys.exit(0)
    main()
