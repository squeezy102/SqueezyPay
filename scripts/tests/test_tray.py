"""Tests for pure-Python helper functions in tray.py.

These tests cover logic that does not require a running GUI, a real Windows
environment, or any network connections.  All Windows-only and GUI modules are
mocked before the import so the suite runs on Linux CI without modification.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Mock Windows-only and GUI dependencies BEFORE importing tray
# ---------------------------------------------------------------------------

sys.modules["pystray"] = MagicMock()
sys.modules["PIL"] = MagicMock()
sys.modules["PIL.Image"] = MagicMock()
sys.modules["PIL.ImageDraw"] = MagicMock()
sys.modules["winreg"] = MagicMock()
sys.modules["requests"] = MagicMock()

import ctypes  # noqa: E402 — must come after sys.modules patching

if not hasattr(ctypes, "windll"):
    ctypes.windll = MagicMock()

# conftest.py already inserts scripts/ into sys.path; the insert here is a
# safety net for running this file directly.
_scripts_dir = str(Path(__file__).resolve().parent.parent)
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

import tray  # noqa: E402, I001


# ---------------------------------------------------------------------------
# Icon rendering
# ---------------------------------------------------------------------------


def test_make_icon_returns_rgba_image():
    """
    Scenario: _make_icon is called with the green colour constant
    EP class: valid colour tuple (R, G, B within 0-255)
    Expected: return value is not None (PIL.Image.new mock returns a MagicMock,
              which is truthy — confirms no exception is raised)
    """
    result = tray._make_icon((34, 197, 94))
    assert result is not None


# ---------------------------------------------------------------------------
# Status colour logic
# ---------------------------------------------------------------------------


def test_status_color_all_up():
    """
    Scenario: all three services report running=True
    EP class: valid partition — all-up state
    Expected: returns the green colour constant (34, 197, 94)
    """
    status = {
        "admin":    {"running": True},
        "backend":  {"running": True},
        "frontend": {"running": True},
    }
    assert tray._status_color(status) == (34, 197, 94)


def test_status_color_all_down():
    """
    Scenario: all three services report running=False
    EP class: valid partition — all-down state
    Expected: returns the red colour constant (239, 68, 68)
    """
    status = {
        "admin":    {"running": False},
        "backend":  {"running": False},
        "frontend": {"running": False},
    }
    assert tray._status_color(status) == (239, 68, 68)


def test_status_color_partial():
    """
    Scenario: exactly one of three services is running
    EP class: boundary — partial-up state (1 of 3)
    Expected: returns the yellow colour constant (234, 179, 8)
    """
    status = {
        "admin":    {"running": True},
        "backend":  {"running": False},
        "frontend": {"running": False},
    }
    assert tray._status_color(status) == (234, 179, 8)


def test_status_color_two_up():
    """
    Scenario: exactly two of three services are running
    EP class: boundary — partial-up state (2 of 3)
    Expected: returns the yellow colour constant (234, 179, 8)
    """
    status = {
        "admin":    {"running": True},
        "backend":  {"running": True},
        "frontend": {"running": False},
    }
    assert tray._status_color(status) == (234, 179, 8)


# ---------------------------------------------------------------------------
# Tooltip text
# ---------------------------------------------------------------------------


def test_status_tooltip_all_up():
    """
    Scenario: tooltip is generated when all services are running
    EP class: valid partition — all-up state
    Expected: string contains "SqueezyPay" and exactly three filled-dot chars
    """
    status = {
        "admin":    {"running": True},
        "backend":  {"running": True},
        "frontend": {"running": True},
    }
    tooltip = tray._status_tooltip(status)
    assert "SqueezyPay" in tooltip
    assert tooltip.count("●") == 3


def test_status_tooltip_all_down():
    """
    Scenario: tooltip is generated when all services are stopped
    EP class: valid partition — all-down state
    Expected: string contains exactly three empty-dot chars and no filled-dot chars
    """
    status = {
        "admin":    {"running": False},
        "backend":  {"running": False},
        "frontend": {"running": False},
    }
    tooltip = tray._status_tooltip(status)
    assert tooltip.count("○") == 3
    assert tooltip.count("●") == 0


# ---------------------------------------------------------------------------
# Service label helper
# ---------------------------------------------------------------------------


def test_svc_label_running():
    """
    Scenario: _svc_label for a service that is running
    EP class: valid partition — running=True
    Expected: label starts with the filled-dot indicator "● "
    """
    label = tray._svc_label("backend", {"backend": {"running": True}})
    assert label.startswith("● ")


def test_svc_label_stopped():
    """
    Scenario: _svc_label for a service that is stopped
    EP class: valid partition — running=False
    Expected: label starts with the empty-dot indicator "○ "
    """
    label = tray._svc_label("backend", {"backend": {"running": False}})
    assert label.startswith("○ ")


def test_svc_label_missing_key():
    """
    Scenario: _svc_label is called with an empty status dict (service key absent)
    EP class: invalid/boundary — missing key defaults to stopped
    Expected: label starts with the empty-dot indicator "○ " (same as stopped)
    """
    label = tray._svc_label("backend", {})
    assert label.startswith("○ ")
