"""
Admin server tests.

Covers:
- All imports resolve (startup smoke)
- /api/status returns expected shape
- /api/start and /api/stop reject unknown services
- Single-instance guard: _is_port_in_use detects occupied ports
- service_status reflects port state
- start_service rejects duplicate starts
"""
import socket
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import main as admin_main
from main import _is_port_in_use, app, service_status

client = TestClient(app)


# ── Startup smoke ─────────────────────────────────────────────────────────────

def test_imports():
    """All top-level imports in admin/main.py resolve."""
    assert admin_main is not None


def test_app_constructed():
    """FastAPI app object is constructed without error."""
    assert app is not None
    assert app.title == "SqueezyPay Admin"


# ── /api/status ───────────────────────────────────────────────────────────────

def test_status_returns_200():
    r = client.get("/api/status")
    assert r.status_code == 200


def test_status_contains_backend():
    r = client.get("/api/status")
    data = r.json()
    assert "backend" in data
    be = data["backend"]
    assert "running" in be
    assert "port" in be
    assert "url" in be
    assert be["port"] == 8000


def test_status_frontend_present_in_dev_mode():
    """In dev mode the status response includes a frontend key."""
    if admin_main._MODE != "dev":
        pytest.skip("Not in dev mode")
    r = client.get("/api/status")
    data = r.json()
    assert "frontend" in data
    fe = data["frontend"]
    assert "running" in fe
    assert fe["port"] == 5173


# ── /api/start unknown service ────────────────────────────────────────────────

def test_start_unknown_service():
    r = client.post("/api/start/nonexistent")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is False
    assert "Unknown service" in data["message"]


def test_stop_unknown_service():
    r = client.post("/api/stop/nonexistent")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is False
    assert "Unknown service" in data["message"]


# ── _is_port_in_use ───────────────────────────────────────────────────────────

def test_port_not_in_use_on_unused_port():
    # Port 19999 is almost certainly free in CI
    assert _is_port_in_use(19999) is False


def test_port_in_use_when_bound():
    """Bind a socket to a port, confirm _is_port_in_use returns True."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", 19998))
    sock.listen(1)
    try:
        assert _is_port_in_use(19998) is True
    finally:
        sock.close()


# ── start_service duplicate guard ─────────────────────────────────────────────

def test_start_backend_already_running():
    """start_service returns ok=False when backend port is already in use."""
    with patch.object(admin_main, "_is_port_in_use", return_value=True), \
         patch.object(admin_main, "_process_alive", return_value=False):
        r = client.post("/api/start/backend")
    data = r.json()
    assert data["ok"] is False
    assert "already running" in data["message"].lower()


def test_start_frontend_already_running():
    if admin_main._MODE != "dev":
        pytest.skip("Not in dev mode")
    with patch.object(admin_main, "_is_port_in_use", return_value=True), \
         patch.object(admin_main, "_process_alive", return_value=False):
        r = client.post("/api/start/frontend")
    data = r.json()
    assert data["ok"] is False
    assert "already running" in data["message"].lower()


# ── Dashboard HTML ─────────────────────────────────────────────────────────────

def test_dashboard_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "SqueezyPay" in r.text


def test_dashboard_has_home_view():
    r = client.get("/")
    assert "view-home" in r.text


def test_dashboard_has_admin_view():
    r = client.get("/")
    assert "view-admin" in r.text


# ── Logs endpoints ────────────────────────────────────────────────────────────

def test_recent_logs_returns_list():
    r = client.get("/api/logs/recent")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_recent_logs_no_log_file(tmp_path):
    original = admin_main.LOG_FILE
    admin_main.LOG_FILE = tmp_path / "nonexistent.log"
    try:
        r = client.get("/api/logs/recent")
        assert r.status_code == 200
        assert r.json() == []
    finally:
        admin_main.LOG_FILE = original
