"""SqueezyPay Admin Dashboard server.

Runs on port 9000.  Manages the backend.exe process and streams logs.

Packaged layout (installed via Inno Setup):
  {app}\\backend.exe          — main backend
  {app}\\admin\\main.py        — this file
  %APPDATA%\\SqueezyPay\\logs\\ — log files written by backend.exe

Dev layout (source tree):
  backend/main.py            — backend (started via venv python)
  admin/main.py              — this file
  backend/logs/              — log files
"""
import json
import logging
import os
import subprocess
import time
import winreg
from contextlib import asynccontextmanager
from pathlib import Path

import psutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse


class _SuppressHealthPolling(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not ("/api/status" in msg and '" 200' in msg)


logging.getLogger("uvicorn.access").addFilter(_SuppressHealthPolling())

# ---------------------------------------------------------------------------
# Path resolution — works in both packaged and dev modes
# ---------------------------------------------------------------------------

_THIS_FILE = Path(__file__).resolve()


def _is_packaged() -> bool:
    """True when running from an Inno Setup install ({app}\\admin\\main.py)."""
    return (_THIS_FILE.parent.parent / "backend.exe").exists()


if _is_packaged():
    APP_DIR     = _THIS_FILE.parent.parent
    BACKEND_EXE = APP_DIR / "backend.exe"
    LOG_DIR     = Path(os.environ.get("APPDATA", "")) / "SqueezyPay" / "logs"
    _MODE       = "packaged"
else:
    REPO_ROOT    = _THIS_FILE.parent.parent
    BACKEND_DIR  = REPO_ROOT / "backend"
    FRONTEND_DIR = REPO_ROOT / "frontend"
    BACKEND_EXE  = None
    VENV_PYTHON  = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    LOG_DIR      = BACKEND_DIR / "logs"
    _MODE        = "dev"

LOG_FILE      = LOG_DIR / "squeezypay.log"
BACKEND_PORT  = 8000
FRONTEND_PORT = 5173
ADMIN_PORT    = 9000

_processes:   dict[str, subprocess.Popen] = {}
_log_handles: dict[str, object] = {}


# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------

def _read_reg_env(hive, subkey: str) -> dict:
    result = {}
    try:
        with winreg.OpenKey(hive, subkey) as key:
            i = 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(key, i)
                    result[name.upper()] = os.path.expandvars(str(value))
                    i += 1
                except OSError:
                    break
    except OSError:
        pass
    return result


def _load_user_env() -> dict:
    """Merge system + user registry env vars so child processes get SQUEEZYPAY_* keys."""
    sys_env  = _read_reg_env(winreg.HKEY_LOCAL_MACHINE,
                             r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
    user_env = _read_reg_env(winreg.HKEY_CURRENT_USER, "Environment")

    env = {k.upper(): v for k, v in os.environ.items()}
    env.update(sys_env)
    env.update(user_env)

    orig_path = env.get("PATH", "")
    sys_path  = sys_env.get("PATH", "")
    user_path = user_env.get("PATH", "")
    env["PATH"] = ";".join(p for p in [orig_path, sys_path, user_path] if p)
    return env


# ---------------------------------------------------------------------------
# Process management
# ---------------------------------------------------------------------------

def _open_log(name: str):
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / f"{name}.log"
    old = _log_handles.get(name)
    if old:
        try:
            old.close()
        except Exception:
            pass
    handle = open(path, "a", encoding="utf-8", buffering=1)
    _log_handles[name] = handle
    return handle


def _is_port_in_use(port: int) -> bool:
    for conn in psutil.net_connections():
        if conn.laddr.port == port and conn.status == "LISTEN":
            if conn.pid:
                try:
                    psutil.Process(conn.pid)
                    return True
                except psutil.NoSuchProcess:
                    continue
            else:
                return True
    return False


def _process_alive(name: str) -> bool:
    proc = _processes.get(name)
    return proc is not None and proc.poll() is None


def _kill_by_port(port: int) -> bool:
    for conn in psutil.net_connections():
        if conn.laddr.port == port and conn.status == "LISTEN" and conn.pid:
            try:
                proc = psutil.Process(conn.pid)
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except (psutil.TimeoutExpired, psutil.NoSuchProcess):
                    try:
                        proc.kill()
                    except psutil.NoSuchProcess:
                        pass
                return True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    return False


def service_status() -> dict:
    status = {
        "backend": {
            "running": _process_alive("backend") or _is_port_in_use(BACKEND_PORT),
            "port": BACKEND_PORT,
            "url": f"http://localhost:{BACKEND_PORT}",
            "browseable": False,
        },
    }
    if _MODE == "dev":
        frontend_running = _process_alive("frontend") or _is_port_in_use(FRONTEND_PORT)
        status["frontend"] = {
            "running": frontend_running,
            "port": FRONTEND_PORT,
            "url": f"http://localhost:{FRONTEND_PORT}",
            "browseable": frontend_running,
        }
    return status


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for proc in _processes.values():
        if proc.poll() is None:
            proc.terminate()


app = FastAPI(title="SqueezyPay Admin", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
def get_status():
    return service_status()


@app.post("/api/start/{service}")
def start_service(service: str):
    if service == "backend":
        if _process_alive("backend") or _is_port_in_use(BACKEND_PORT):
            return {"ok": False, "message": "Backend is already running"}
        env = {**_load_user_env(), "PYTHONUNBUFFERED": "1"}
        log = _open_log("backend")
        if _MODE == "packaged":
            cmd = [str(BACKEND_EXE)]
            cwd = str(APP_DIR)
        else:
            cmd = [str(VENV_PYTHON), "main.py"]
            cwd = str(BACKEND_DIR)
        proc = subprocess.Popen(
            cmd, cwd=cwd, env=env, stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        )
        _processes["backend"] = proc
        return {"ok": True, "message": "Backend started"}

    if service == "frontend":
        if _MODE == "packaged":
            return {"ok": False, "message": "Frontend is served by the backend in packaged mode"}
        if _process_alive("frontend") or _is_port_in_use(FRONTEND_PORT):
            return {"ok": False, "message": "Frontend is already running"}
        log = _open_log("frontend")
        npm = str(FRONTEND_DIR / "node_modules" / ".bin" / "vite.cmd")
        if not Path(npm).exists():
            npm = "npm"
        proc = subprocess.Popen(
            [npm, "run", "dev"] if npm == "npm" else [npm],
            cwd=str(FRONTEND_DIR),
            env={**os.environ.copy()},
            stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        )
        _processes["frontend"] = proc
        return {"ok": True, "message": "Frontend started"}

    return {"ok": False, "message": f"Unknown service: {service}"}


@app.post("/api/stop/{service}")
def stop_service(service: str):
    port = BACKEND_PORT if service == "backend" else FRONTEND_PORT if service == "frontend" else None
    if port is None:
        return {"ok": False, "message": f"Unknown service: {service}"}

    proc = _processes.get(service)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    _processes.pop(service, None)
    _kill_by_port(port)
    for _ in range(6):
        if not _is_port_in_use(port):
            return {"ok": True, "message": f"{service.capitalize()} stopped"}
        time.sleep(0.5)
    return {"ok": False, "message": f"{service.capitalize()} did not stop"}


@app.get("/api/logs")
def stream_logs():
    def generate():
        if not LOG_FILE.exists():
            yield f"data: {json.dumps({'message': 'No log file found yet. Start the backend to begin logging.'})}\n\n"
            return
        with open(LOG_FILE, encoding="utf-8") as f:
            f.seek(0, 2)
            while True:
                line = f.readline()
                if line:
                    line = line.strip()
                    if line:
                        yield f"data: {line}\n\n"
                else:
                    time.sleep(0.5)

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/logs/recent")
def recent_logs(lines: int = 100):
    if not LOG_FILE.exists():
        return []
    with open(LOG_FILE, encoding="utf-8") as f:
        all_lines = f.readlines()
    recent = [line.strip() for line in all_lines[-lines:] if line.strip()]
    parsed = []
    for line in recent:
        try:
            parsed.append(json.loads(line))
        except Exception:
            parsed.append({"message": line, "level": "INFO", "timestamp": "", "service": ""})
    return parsed


@app.get("/api/logs/raw")
def raw_log():
    if not LOG_FILE.exists():
        return HTMLResponse("No log file found yet.", media_type="text/plain")
    with open(LOG_FILE, encoding="utf-8") as f:
        content = f.read()
    return HTMLResponse(content, media_type="text/plain; charset=utf-8")


@app.get("/", response_class=HTMLResponse)
def dashboard():
    html_path = _THIS_FILE.parent / "dashboard.html"
    with open(html_path, encoding="utf-8") as f:
        return f.read()


if __name__ == "__main__":
    import webbrowser
    import uvicorn

    if _is_port_in_use(ADMIN_PORT):
        # Another instance is already running — focus it instead of starting a second one.
        print(f"SqueezyPay admin is already running at http://localhost:{ADMIN_PORT}")
        webbrowser.open(f"http://localhost:{ADMIN_PORT}")
    else:
        uvicorn.run(app, host="127.0.0.1", port=ADMIN_PORT)
