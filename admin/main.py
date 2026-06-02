import subprocess
import sys
import os
import json
import time
import logging
import winreg
import psutil
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from contextlib import asynccontextmanager


class _SuppressHealthPolling(logging.Filter):
    """Drop successful GET /api/status lines from uvicorn access log."""
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not ("/api/status" in msg and '" 200' in msg)


logging.getLogger("uvicorn.access").addFilter(_SuppressHealthPolling())

ROOT = Path(__file__).parent.parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
LOG_FILE = BACKEND_DIR / "logs" / "squeezypay.log"
VENV_PYTHON = BACKEND_DIR / "venv" / "Scripts" / "python.exe"

_processes: dict[str, subprocess.Popen] = {}


def _load_user_env() -> dict:
    """Read Windows user environment variables from the registry and merge with os.environ.

    Start-Process does not guarantee user env vars are visible to child processes
    when launched from a shortcut context. SQUEEZYPAY_SECRET_KEY and
    SQUEEZYPAY_ENCRYPTION_KEY live in HKCU\Environment and must be explicitly loaded.
    """
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


def _is_port_in_use(port: int) -> bool:
    for conn in psutil.net_connections():
        if conn.laddr.port == port and conn.status == "LISTEN":
            return True
    return False


def _process_alive(name: str) -> bool:
    proc = _processes.get(name)
    if proc is None:
        return False
    return proc.poll() is None


def service_status() -> dict:
    return {
        "backend": {
            "running": _process_alive("backend") or _is_port_in_use(8000),
            "port": 8000,
            "url": "http://localhost:8000",
        },
        "frontend": {
            "running": _process_alive("frontend") or _is_port_in_use(5173),
            "port": 5173,
            "url": "http://localhost:5173",
            "browseable": True,
        },
    }


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
        if _process_alive("backend") or _is_port_in_use(8000):
            return {"ok": False, "message": "Backend is already running"}
        env = {**_load_user_env(), "PYTHONUNBUFFERED": "1"}
        proc = subprocess.Popen(
            [str(VENV_PYTHON), "main.py"],
            cwd=str(BACKEND_DIR),
            env=env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        _processes["backend"] = proc
        return {"ok": True, "message": "Backend started"}

    if service == "frontend":
        if _process_alive("frontend") or _is_port_in_use(5173):
            return {"ok": False, "message": "Frontend is already running"}
        proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            shell=True,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        _processes["frontend"] = proc
        return {"ok": True, "message": "Frontend started"}

    return {"ok": False, "message": f"Unknown service: {service}"}


def _kill_by_port(port: int) -> bool:
    """Kill whichever process is listening on the given port. Returns True if killed."""
    for conn in psutil.net_connections():
        if conn.laddr.port == port and conn.status == "LISTEN" and conn.pid:
            try:
                psutil.Process(conn.pid).terminate()
                return True
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    return False


@app.post("/api/stop/{service}")
def stop_service(service: str):
    port_map = {"backend": 8000, "frontend": 5173}
    if service not in port_map:
        return {"ok": False, "message": f"Unknown service: {service}"}

    port = port_map[service]

    # Try tracked handle first; fall back to killing by port.
    proc = _processes.get(service)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        _processes.pop(service, None)
        return {"ok": True, "message": f"{service.capitalize()} stopped"}

    if _kill_by_port(port):
        _processes.pop(service, None)
        return {"ok": True, "message": f"{service.capitalize()} stopped"}

    return {"ok": False, "message": f"{service.capitalize()} is not running"}


@app.get("/api/logs")
def stream_logs():
    def generate():
        if not LOG_FILE.exists():
            yield f"data: {json.dumps({'message': 'No log file found yet. Start the backend to begin logging.'})}\n\n"
            return
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            f.seek(0, 2)  # seek to end
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
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        all_lines = f.readlines()
    recent = [line.strip() for line in all_lines[-lines:] if line.strip()]
    parsed = []
    for line in recent:
        try:
            parsed.append(json.loads(line))
        except Exception:
            parsed.append({"message": line, "level": "INFO", "timestamp": "", "service": ""})
    return parsed


@app.get("/", response_class=HTMLResponse)
def dashboard():
    with open(Path(__file__).parent / "dashboard.html", "r", encoding="utf-8") as f:
        return f.read()
