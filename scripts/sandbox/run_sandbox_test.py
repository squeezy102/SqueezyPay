"""
SqueezyPay Windows Sandbox test orchestrator.

Usage:
    python scripts/sandbox/run_sandbox_test.py [--installer PATH] [--max-rounds N]

If --installer is not provided, the script downloads the latest release
artifact from GitHub.

Requires:
    - Windows 11 Pro with Windows Sandbox enabled
      (run scripts/sandbox/enable_sandbox.ps1 as Administrator, then reboot)
    - gh CLI authenticated (gh auth status)
    - Python 3.9+

How it works:
    1. Locates or downloads SqueezyPay-Setup.exe
    2. Creates a temp staging folder with the installer + exerciser script
    3. Writes a .wsb config that maps the staging folder into the sandbox
    4. Launches WindowsSandbox.exe with that config
    5. Sandbox runs silently, installs the app, exercises it, writes results.json
    6. Host reads results.json, computes a confidence score, reports findings
    7. Repeats until score >= 80 or max rounds exceeded

Confidence scoring (100 points total):
    installer_found  +10
    install_exit==0  +20
    backend_started  +20
    health_ok        +10
    auth_configured  +15
    login_ok         +15
    bills_ok         +5
    spa_served       +5
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

REPO                 = "squeezy102/SqueezyPay"
SANDBOX_EXE          = Path(r"C:\Windows\System32\WindowsSandbox.exe")
EXERCISER_SCRIPT     = Path(__file__).parent / "sandbox_exerciser.ps1"
SCORE_WEIGHTS = {
    "installer_found":  10,
    "install_exit":     20,   # install_exit == 0
    "backend_started":  20,
    "health_ok":        10,
    "auth_configured":  15,
    "login_ok":         15,
    "bills_ok":          5,
    "spa_served":        5,
}


def check_prerequisites() -> list[str]:
    problems = []
    if not SANDBOX_EXE.exists():
        problems.append(
            "Windows Sandbox is not installed. "
            "Run scripts/sandbox/enable_sandbox.ps1 as Administrator and reboot."
        )
    if not EXERCISER_SCRIPT.exists():
        problems.append(f"Exerciser script not found: {EXERCISER_SCRIPT}")
    result = subprocess.run(["gh", "auth", "status"], capture_output=True)
    if result.returncode != 0:
        problems.append("gh CLI not authenticated. Run: gh auth login")
    return problems


def download_latest_installer(dest_dir: Path) -> Path:
    print("Downloading latest release installer from GitHub...")
    result = subprocess.run(
        ["gh", "release", "download", "--repo", REPO,
         "--pattern", "SqueezyPay-Setup.exe",
         "--dir", str(dest_dir),
         "--clobber"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        # Try downloading from latest release explicitly
        result2 = subprocess.run(
            ["gh", "release", "download", "latest", "--repo", REPO,
             "--pattern", "SqueezyPay-Setup.exe",
             "--dir", str(dest_dir),
             "--clobber"],
            capture_output=True, text=True
        )
        if result2.returncode != 0:
            raise RuntimeError(
                f"Failed to download installer:\n{result.stderr}\n{result2.stderr}\n"
                "Make sure a release with SqueezyPay-Setup.exe exists on GitHub."
            )
    installer = dest_dir / "SqueezyPay-Setup.exe"
    if not installer.exists():
        raise RuntimeError(f"Installer not found at {installer} after download")
    size_mb = installer.stat().st_size / (1024 * 1024)
    print(f"  Downloaded: {installer} ({size_mb:.1f} MB)")
    return installer


def write_wsb_config(staging_dir: Path, wsb_path: Path) -> None:
    # The LogonCommand runs the exerciser inside the sandbox.
    # Results are written to C:\TestAssets\results.json (the mapped folder).
    exerciser_sandboxed = r"C:\TestAssets\sandbox_exerciser.ps1"
    installer_sandboxed = r"C:\TestAssets\SqueezyPay-Setup.exe"
    results_sandboxed   = r"C:\TestAssets\results.json"

    logon_cmd = r"C:\TestAssets\launch_exerciser.bat"

    wsb_content = f"""<Configuration>
  <VGpu>Disable</VGpu>
  <Networking>Enable</Networking>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>{staging_dir}</HostFolder>
      <SandboxFolder>C:\\TestAssets</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>{logon_cmd}</Command>
  </LogonCommand>
</Configuration>"""
    wsb_path.write_text(wsb_content, encoding="utf-8")


def compute_score(results: dict) -> tuple[int, list[str]]:
    score = 0
    notes = []
    for key, weight in SCORE_WEIGHTS.items():
        val = results.get(key)
        if key == "install_exit":
            earned = weight if val == 0 else 0
        else:
            earned = weight if val else 0
        score += earned
        status = "PASS" if earned == weight else "FAIL"
        notes.append(f"  [{status}] {key:<20} {earned:>3}/{weight}")
    return score, notes


def write_launcher_bat(staging_dir: Path) -> None:
    # LogonCommand fires at sandbox logon.
    # Results are written to C:\results.json inside the sandbox (writable),
    # then copied out to the mapped folder (C:\TestAssets) which has
    # write permissions granted by prepare_staging_dir().
    bat = staging_dir / "launch_exerciser.bat"
    bat.write_text(
        "@echo off\r\n"
        "timeout /t 10 /nobreak >nul\r\n"
        "powershell.exe -ExecutionPolicy Bypass -File "
        '"C:\\TestAssets\\sandbox_exerciser.ps1" '
        '-InstallerPath "C:\\TestAssets\\SqueezyPay-Setup.exe" '
        '-ResultsPath "C:\\results.json"\r\n'
        "copy /Y C:\\results.json C:\\TestAssets\\results.json\r\n",
        encoding="utf-8",
    )


def run_round(staging_dir: Path, round_num: int) -> dict:
    results_path = staging_dir / "results.json"
    results_path.unlink(missing_ok=True)

    write_launcher_bat(staging_dir)
    wsb_path = staging_dir / f"test_round_{round_num}.wsb"
    write_wsb_config(staging_dir, wsb_path)

    print(f"\n{'='*60}")
    print(f"Round {round_num} — launching Windows Sandbox")
    print(f"  Config: {wsb_path}")
    print(f"  This will open a Sandbox window. It closes automatically when done.")
    print(f"  Waiting for results (timeout: 8 min)...")

    # Use ShellExecute via PowerShell so the sandbox window attaches to the
    # interactive desktop session. Direct Popen launches into a non-interactive
    # context where WindowsSandboxRemoteSession (the visible UI) never spawns.
    proc = subprocess.Popen([
        "powershell.exe", "-Command",
        f'Start-Process "{SANDBOX_EXE}" -ArgumentList \'"{wsb_path}"\''
    ])

    # Poll for results.json (written by exerciser when done)
    deadline = time.time() + 480  # 8 minute timeout
    while time.time() < deadline:
        time.sleep(5)
        if results_path.exists():
            try:
                data = json.loads(results_path.read_text(encoding="utf-8"))
                # Give sandbox a moment to fully write the file
                time.sleep(2)
                proc.wait(timeout=10)
                return data
            except (json.JSONDecodeError, OSError):
                continue  # still writing

    # Timeout
    proc.terminate()
    return {"errors": ["Sandbox timed out after 5 minutes"]}


def main():
    parser = argparse.ArgumentParser(description="SqueezyPay sandbox installer test")
    parser.add_argument("--installer", help="Path to SqueezyPay-Setup.exe (downloads latest if omitted)")
    parser.add_argument("--max-rounds", type=int, default=5, help="Maximum test rounds (default: 5)")
    parser.add_argument("--confidence-target", type=int, default=80, help="Target confidence score 0-100 (default: 80)")
    args = parser.parse_args()

    print("SqueezyPay Sandbox Test Harness")
    print("=" * 60)

    # Prerequisites
    problems = check_prerequisites()
    if problems:
        print("\nPrerequisites not met:")
        for p in problems:
            print(f"  • {p}")
        sys.exit(1)

    # Set up staging dir (persists between rounds so installer can be reused)
    staging_dir = Path(tempfile.mkdtemp(prefix="squeezypay_sandbox_"))
    print(f"Staging dir: {staging_dir}")
    # Grant Everyone write access so the sandbox user (WDAGUtilityAccount)
    # can write results.json back through the mapped folder.
    subprocess.run(
        ["icacls", str(staging_dir), "/grant", "Everyone:(OI)(CI)F", "/T"],
        capture_output=True,
    )

    try:
        # Get installer
        if args.installer:
            installer_src = Path(args.installer)
            if not installer_src.exists():
                print(f"ERROR: Installer not found: {installer_src}")
                sys.exit(1)
            shutil.copy2(installer_src, staging_dir / "SqueezyPay-Setup.exe")
            print(f"Using local installer: {installer_src}")
        else:
            download_latest_installer(staging_dir)

        # Copy exerciser script into staging dir
        shutil.copy2(EXERCISER_SCRIPT, staging_dir / "sandbox_exerciser.ps1")

        # Run rounds
        best_score   = 0
        round_scores = []

        for round_num in range(1, args.max_rounds + 1):
            results = run_round(staging_dir, round_num)
            score, notes = compute_score(results)
            round_scores.append(score)
            best_score = max(best_score, score)

            print(f"\nRound {round_num} results:")
            for note in notes:
                print(note)
            if results.get("errors"):
                print(f"  Errors:")
                for e in results["errors"]:
                    print(f"    • {e}")
            print(f"\n  Score: {score}/100  (target: {args.confidence_target})")

            if score >= args.confidence_target:
                print(f"\n{'='*60}")
                print(f"Target confidence reached after {round_num} round(s).")
                print(f"Final score: {score}/100")
                break
        else:
            print(f"\n{'='*60}")
            print(f"Max rounds ({args.max_rounds}) reached.")
            print(f"Best score: {best_score}/100  (target: {args.confidence_target})")
            if best_score < args.confidence_target:
                print("Confidence target NOT met. Review errors above and fix before release.")
                sys.exit(1)

        print("\nAll scores by round:", round_scores)

    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
