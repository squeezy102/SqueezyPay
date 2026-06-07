# PyInstaller spec for SqueezyPay backend
#
# Build command (from repo root, Windows):
#   cd backend
#   pyinstaller backend.spec
#
# Output: backend/dist/backend.exe
#
# The --migrate flag is supported at runtime:
#   backend.exe --migrate   (run Alembic upgrade head and exit)
#   backend.exe             (start the server normally)

import sys
from pathlib import Path

backend_dir = Path(SPECPATH)
repo_root   = backend_dir.parent

a = Analysis(
    [str(backend_dir / "main.py")],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[
        # Alembic migration scripts — needed at runtime for --migrate mode
        (str(backend_dir / "alembic"),        "alembic"),
        (str(backend_dir / "alembic.ini"),    "."),
        # Frontend static build — served by FastAPI StaticFiles
        (str(repo_root / "frontend" / "dist"), "frontend/dist"),
        # Admin dashboard
        (str(repo_root / "admin" / "dashboard.html"), "admin"),
        (str(repo_root / "admin" / "main.py"),        "admin"),
    ],
    hiddenimports=[
        # FastAPI / Starlette internals not always auto-detected
        "fastapi",
        "fastapi.middleware.cors",
        "starlette.routing",
        "starlette.middleware.cors",
        "starlette.staticfiles",
        "starlette.responses",
        # Uvicorn
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        # SQLAlchemy dialects
        "sqlalchemy.dialects.sqlite",
        # Alembic
        "alembic",
        "alembic.runtime.migration",
        "alembic.operations",
        "alembic.autogenerate",
        # Cryptography (Fernet)
        "cryptography",
        "cryptography.fernet",
        "cryptography.hazmat.primitives.ciphers",
        "cryptography.hazmat.backends.openssl",
        # JWT
        "jwt",
        "jwt.algorithms",
        # Bcrypt
        "bcrypt",
        # Plaid
        "plaid",
        # Slowapi / limits
        "slowapi",
        "limits",
        "limits.storage",
        # Email validator (pydantic dep)
        "email_validator",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Playwright is excluded here; the Inno Setup [Components] section
    # handles optional Playwright/Chromium installation separately.
    excludes=["playwright", "tkinter", "test", "unittest"],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,   # console=True so log output is visible when run from admin dashboard
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
