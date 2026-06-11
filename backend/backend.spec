# PyInstaller spec for SqueezyPay backend
#
# Build command (from backend/ directory):
#   pyinstaller backend.spec
#
# Output: backend/dist/backend.exe
#
# Runtime flags:
#   backend.exe              — start server, open browser, serve frontend
#   backend.exe --tray       — start system tray icon (auto-start entry point)
#   backend.exe --migrate    — run Alembic upgrade head and exit
#   backend.exe --generate-key fernet <outfile>
#   backend.exe --generate-key secret  <outfile>

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
        # Frontend static build — served by FastAPI StaticFiles at runtime
        (str(repo_root / "frontend" / "dist"), "frontend/dist"),
        # Admin dashboard
        (str(repo_root / "admin" / "dashboard.html"), "admin"),
        (str(repo_root / "admin" / "main.py"),        "admin"),
        # Tray icon — bundled so backend.exe --tray works without Python installed
        (str(repo_root / "scripts" / "tray.py"),      "scripts"),
    ],
    hiddenimports=[
        # FastAPI / Starlette internals not always auto-detected
        "fastapi",
        "fastapi.middleware.cors",
        "fastapi.staticfiles",
        "fastapi.responses",
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        "starlette.staticfiles",
        "starlette.responses",
        "starlette.background",
        "starlette.types",
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
        # AnyIO (uvicorn dependency)
        "anyio",
        "anyio._backends._asyncio",
        # SQLAlchemy dialects
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.dialects.sqlite.pysqlite",
        # Alembic
        "alembic",
        "alembic.runtime.migration",
        "alembic.operations",
        "alembic.autogenerate",
        "alembic.ddl",
        "alembic.ddl.impl",
        "alembic.script",
        "alembic.script.revision",
        # Cryptography (Fernet)
        "cryptography",
        "cryptography.fernet",
        "cryptography.hazmat.primitives.ciphers",
        "cryptography.hazmat.primitives.ciphers.aead",
        "cryptography.hazmat.backends.openssl",
        "cryptography.hazmat.backends.openssl.backend",
        # JWT / bcrypt
        "jwt",
        "jwt.algorithms",
        "bcrypt",
        # Plaid
        "plaid",
        "plaid.api",
        "plaid.model",
        # Slowapi / limits
        "slowapi",
        "limits",
        "limits.storage",
        "limits.storage.memory",
        "limits.strategies",
        # Pydantic
        "pydantic",
        "pydantic.v1",
        "email_validator",
        # Python stdlib modules that sometimes need explicit listing
        "webbrowser",
        "threading",
        "logging.handlers",
        # Tray icon dependencies (backend.exe --tray mode)
        "pystray",
        "PIL",
        "PIL.Image",
        "PIL.ImageDraw",
        "psutil",
        "requests",
        "winreg",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Playwright is excluded — handled as an optional Inno Setup component.
    excludes=["playwright", "tkinter", "test", "unittest"],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

# --onedir mode: EXE is a small launcher; all binaries and data sit alongside it.
# Cold-start is instant — no extraction to a temp dir on every run.
# The installer packages the whole dist/backend/ directory.
exe = EXE(
    pyz,
    a.scripts,
    [],
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,   # console=True so log output is visible when run manually
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="backend",
)
