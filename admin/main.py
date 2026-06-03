import subprocess
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
LOG_DIR = BACKEND_DIR / "logs"
LOG_FILE = LOG_DIR / "squeezypay.log"
VENV_PYTHON = BACKEND_DIR / "venv" / "Scripts" / "python.exe"

BACKEND_PORT = 8000
FRONTEND_PORT = 5173

_processes: dict[str, subprocess.Popen] = {}
_log_handles: dict[str, object] = {}


def _open_log(name: str):
    """Open (or reopen) a rotating log file for a service subprocess."""
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


def _load_user_env() -> dict:
    """Build a full environment by combining system + user registry env vars.

    When launched from a shortcut or scheduled task, os.environ may be missing
    both the system PATH (HKLM) and user env vars (HKCU) such as
    SQUEEZYPAY_SECRET_KEY and SQUEEZYPAY_ENCRYPTION_KEY. Read both explicitly
    and merge them so child processes get a complete environment.

    All keys are uppercased. Windows env vars are case-insensitive at the OS
    level but Python dicts are case-sensitive — without normalization, both
    "PATH" and "Path" can exist in the dict. CreateProcess passes both to the
    child, which uses the last one and ignores the earlier one, silently
    discarding our constructed PATH.
    """
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

    sys_env  = _read_reg_env(winreg.HKEY_LOCAL_MACHINE,
                             r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
    user_env = _read_reg_env(winreg.HKEY_CURRENT_USER, "Environment")

    # Start from os.environ with all keys uppercased to eliminate duplicates.
    env = {k.upper(): v for k, v in os.environ.items()}

    # Merge order: os.environ < system registry < user registry.
    env.update(sys_env)
    env.update(user_env)

    # PATH is special: combine all three sources so nothing is lost.
    orig_path = {k.upper(): v for k, v in os.environ.items()}.get("PATH", "")
    sys_path  = sys_env.get("PATH", "")
    user_path = user_env.get("PATH", "")
    env["PATH"] = ";".join(p for p in [orig_path, sys_path, user_path] if p)

    return env


def _is_port_in_use(port: int) -> bool:
    for conn in psutil.net_connections():
        if conn.laddr.port == port and conn.status == "LISTEN":
            # Verify the owning process is still alive - Windows can show stale entries briefly.
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
    if proc is None:
        return False
    return proc.poll() is None


def service_status() -> dict:
    return {
        "backend": {
            "running": _process_alive("backend") or _is_port_in_use(BACKEND_PORT),
            "port": BACKEND_PORT,
            "url": f"http://localhost:{BACKEND_PORT}",
        },
        "frontend": {
            "running": _process_alive("frontend") or _is_port_in_use(FRONTEND_PORT),
            "port": FRONTEND_PORT,
            "url": f"http://localhost:{FRONTEND_PORT}",
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
        if _process_alive("backend") or _is_port_in_use(BACKEND_PORT):
            return {"ok": False, "message": "Backend is already running"}
        env = {**_load_user_env(), "PYTHONUNBUFFERED": "1"}
        log = _open_log("backend")
        proc = subprocess.Popen(
            [str(VENV_PYTHON), "main.py"],
            cwd=str(BACKEND_DIR),
            env=env,
            stdout=log,
            stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        )
        _processes["backend"] = proc
        return {"ok": True, "message": "Backend started"}

    if service == "frontend":
        if _process_alive("frontend") or _is_port_in_use(FRONTEND_PORT):
            return {"ok": False, "message": "Frontend is already running"}
        env = _load_user_env()
        log = _open_log("frontend")
        proc = subprocess.Popen(
            ["cmd.exe", "/c", "npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            env=env,
            stdout=log,
            stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        )
        _processes["frontend"] = proc
        return {"ok": True, "message": "Frontend started"}

    return {"ok": False, "message": f"Unknown service: {service}"}


def _kill_by_port(port: int) -> bool:
    """Kill whichever process is listening on the given port and wait for it to exit."""
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


@app.post("/api/stop/{service}")
def stop_service(service: str):
    port_map = {"backend": BACKEND_PORT, "frontend": FRONTEND_PORT}
    if service not in port_map:
        return {"ok": False, "message": f"Unknown service: {service}"}

    port = port_map[service]

    # Terminate the tracked handle (may be a cmd.exe wrapper).
    proc = _processes.get(service)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    _processes.pop(service, None)

    # Always kill by port - catches orphaned child processes (e.g. node under cmd.exe).
    # Wait up to 3s for the port to be released after killing.
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


@app.get("/api/logs/raw")
def raw_log():
    if not LOG_FILE.exists():
        return HTMLResponse("No log file found yet.", media_type="text/plain")
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    return HTMLResponse(content, media_type="text/plain; charset=utf-8")


@app.get("/", response_class=HTMLResponse)
def dashboard():
    with open(Path(__file__).parent / "dashboard.html", "r", encoding="utf-8") as f:
        return f.read()
