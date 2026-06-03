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

_processes: dict[str, subprocess.Popen] = {}
_log_handles: dict[str, object] = {}


def _open_log(name: str):
    """Open (or reopen) a rotating log file for a service subprocess."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / f"{name}.log"
    # Close any previous handle before reopening
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
    """
    env = dict(os.environ)

    def _read_reg_env(hive, subkey: str) -> dict:
        result = {}
        try:
            with winreg.OpenKey(hive, subkey) as key:
                i = 0
                while True:
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                        result[name] = os.path.expandvars(str(value))
                        i += 1
                    except OSError:
                        break
        except OSError:
            pass
        return result

    sys_env  = _read_reg_env(winreg.HKEY_LOCAL_MACHINE,
                             r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
    user_env = _read_reg_env(winreg.HKEY_CURRENT_USER, "Environment")

    # Merge order: os.environ < system registry < user registry.
    # PATH is special: combine all three deduplicated sources rather than letting one win.
    # Read raw PATH values from registry directly to avoid expandvars misses.
    def _reg_path_raw(hive, subkey: str) -> str:
        try:
            with winreg.OpenKey(hive, subkey) as key:
                value, _ = winreg.QueryValueEx(key, "PATH")
                return os.path.expandvars(str(value))
        except OSError:
            return ""

    sys_path_raw  = _reg_path_raw(winreg.HKEY_LOCAL_MACHINE,
                                  r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
    user_path_raw = _reg_path_raw(winreg.HKEY_CURRENT_USER, "Environment")

    env.update(sys_env)
    env.update(user_env)

    # Build PATH: start with system and user registry paths, then append current process PATH.
    # Put nodejs dir first to ensure node resolves even if PATH search order is truncated.
    nodejs_dir = _find_nodejs_dir()
    base_paths = [nodejs_dir] if nodejs_dir else []
    base_paths += [sys_path_raw, user_path_raw, os.environ.get("PATH", "")]
    env["PATH"] = ";".join(p for p in base_paths if p)

    return env


def _find_nodejs_dir() -> str:
    """Return the nodejs install directory (containing node.exe), or empty string."""
    candidates = [
        r"C:\Program Files\nodejs",
        r"C:\Program Files (x86)\nodejs",
    ]
    for c in candidates:
        if Path(c, "node.exe").exists():
            return c
    return ""


def _find_npm() -> str:
    """Locate npm.cmd by searching all PATH sources directly from the registry.

    Reads system and user PATH from registry without relying on os.environ,
    because the admin process may be launched with a stripped environment
    that doesn't include the system PATH. Falls back to well-known locations
    before giving up.
    """
    def _reg_path(hive, subkey: str) -> str:
        try:
            with winreg.OpenKey(hive, subkey) as key:
                value, _ = winreg.QueryValueEx(key, "PATH")
                return str(value)
        except OSError:
            return ""

    sys_path = _reg_path(winreg.HKEY_LOCAL_MACHINE,
                         r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
    user_path = _reg_path(winreg.HKEY_CURRENT_USER, "Environment")
    all_path = ";".join(p for p in [os.environ.get("PATH", ""), sys_path, user_path] if p)

    for directory in all_path.split(";"):
        candidate = Path(directory.strip()) / "npm.cmd"
        if candidate.exists():
            return str(candidate)

    # Well-known fallback locations
    for fallback in [
        r"C:\Program Files\nodejs\npm.cmd",
        r"C:\Program Files (x86)\nodejs\npm.cmd",
    ]:
        if Path(fallback).exists():
            return fallback

    return "npm.cmd"


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
        if _process_alive("frontend") or _is_port_in_use(5173):
            return {"ok": False, "message": "Frontend is already running"}
        nodejs_dir = _find_nodejs_dir()
        if not nodejs_dir:
            return {"ok": False, "message": "Node.js not found — install Node.js and try again"}
        node_exe = str(Path(nodejs_dir) / "node.exe")
        vite_js = str(FRONTEND_DIR / "node_modules" / "vite" / "bin" / "vite.js")
        env = _load_user_env()
        # Ensure user profile vars are set so node can expand %USERPROFILE% in its cache path.
        for var in ("USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"):
            if var not in env and var in os.environ:
                env[var] = os.environ[var]
        log = _open_log("frontend")
        # Invoke node directly to run vite — bypasses the batch-file PATH inheritance chain
        # (npm.cmd → vite.cmd → node) that fails when the admin has a stripped environment.
        proc = subprocess.Popen(
            [node_exe, vite_js],
            cwd=str(FRONTEND_DIR),
            env=env,
            stdout=log,
            stderr=log,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
        )
        _processes["frontend"] = proc
        return {"ok": True, "message": f"Frontend started (node: {node_exe})"}

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
    port_map = {"backend": 8000, "frontend": 5173}
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


@app.get("/api/debug/env")
def debug_env():
    """Return resolved tool paths and key environment info for the admin server process."""
    env = _load_user_env()
    npm_cmd = _find_npm()
    nodejs_dir = _find_nodejs_dir()
    node_exe = str(Path(nodejs_dir) / "node.exe") if nodejs_dir else None
    try:
        result = subprocess.run(
            [node_exe, "--version"] if node_exe else ["node", "--version"],
            env=env,
            capture_output=True,
            text=True,
            timeout=5,
        )
        node_version = result.stdout.strip() or result.stderr.strip()
    except Exception as e:
        node_version = f"error: {e}"
    path_entries = [p for p in env.get("PATH", "").split(";") if p.strip()]
    return {
        "npm_resolved": npm_cmd,
        "npm_cmd_exists": Path(npm_cmd).exists() if npm_cmd != "npm.cmd" else False,
        "node_exe": node_exe,
        "node_exe_exists": Path(node_exe).exists() if node_exe else False,
        "node_version": node_version,
        "path_entry_count": len(path_entries),
        "nodejs_entries": [p for p in path_entries if "node" in p.lower() or "npm" in p.lower()],
    }


@app.get("/", response_class=HTMLResponse)
def dashboard():
    with open(Path(__file__).parent / "dashboard.html", "r", encoding="utf-8") as f:
        return f.read()
