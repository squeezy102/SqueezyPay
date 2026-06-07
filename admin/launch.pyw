"""
SqueezyPay launcher — run with pythonw.exe (no console window).

If the admin is already running on port 9000, just opens the browser.
Otherwise starts admin/main.py as a background process and then opens the browser.
"""
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ADMIN_PORT = 9000
ADMIN_URL  = f"http://localhost:{ADMIN_PORT}"
THIS_DIR   = Path(__file__).resolve().parent


def _port_responding() -> bool:
    try:
        urllib.request.urlopen(ADMIN_URL, timeout=2)
        return True
    except Exception:
        return False


if _port_responding():
    webbrowser.open(ADMIN_URL)
else:
    pythonw = Path(sys.executable).parent / "pythonw.exe"
    if not pythonw.exists():
        pythonw = sys.executable

    subprocess.Popen(
        [str(pythonw), str(THIS_DIR / "main.py")],
        cwd=str(THIS_DIR),
        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW,
        close_fds=True,
    )

    # Wait up to 10s for admin to be ready, then open browser
    for _ in range(20):
        time.sleep(0.5)
        if _port_responding():
            break

    webbrowser.open(ADMIN_URL)
