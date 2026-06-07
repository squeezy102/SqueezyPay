"""CI warning gate — fails if output contains unapproved warnings.

Usage (in GitHub Actions):
    python scripts/check_ci_warnings.py --input <log_file> [--ignore .ci-ignore-warnings]

Exit 0 if no unapproved warnings. Exit 1 and print offending lines otherwise.

In CI the input file is produced by redirecting stdout/stderr of the test run
through 'tee'.  The script scans for lines that contain warning-level signals
not covered by the ignore list.
"""
import argparse
import re
import sys
from pathlib import Path

# Patterns that indicate a warning regardless of casing
_WARNING_SIGNALS = [
    re.compile(r"\bwarning\b", re.IGNORECASE),
    re.compile(r"\bdeprecation\b", re.IGNORECASE),
    re.compile(r"##\[warning\]", re.IGNORECASE),   # GitHub Actions annotation
]

# Lines that are known-noisy but not actionable (structural noise, not content)
_STRUCTURAL_NOISE = [
    re.compile(r"^\s*$"),
    re.compile(r"^--"),
    re.compile(r"^={3,}"),
    re.compile(r"short test summary", re.IGNORECASE),
]


def load_ignore_patterns(ignore_file: Path) -> list[str]:
    if not ignore_file.exists():
        return []
    patterns = []
    for line in ignore_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            patterns.append(line)
    return patterns


def is_warning_line(line: str) -> bool:
    for noise in _STRUCTURAL_NOISE:
        if noise.search(line):
            return False
    return any(sig.search(line) for sig in _WARNING_SIGNALS)


def is_approved(line: str, ignore_patterns: list[str]) -> bool:
    return any(pat in line for pat in ignore_patterns)


def main():
    parser = argparse.ArgumentParser(description="CI warning gate")
    parser.add_argument("--input", required=True, help="Log file to scan")
    parser.add_argument("--ignore", default=".ci-ignore-warnings", help="Ignore patterns file")
    args = parser.parse_args()

    log_path    = Path(args.input)
    ignore_file = Path(args.ignore)

    if not log_path.exists():
        print(f"ERROR: log file not found: {log_path}")
        sys.exit(2)

    ignore_patterns = load_ignore_patterns(ignore_file)
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()

    violations: list[tuple[int, str]] = []
    for i, line in enumerate(lines, 1):
        if is_warning_line(line) and not is_approved(line, ignore_patterns):
            violations.append((i, line))

    if violations:
        print(f"CI WARNING GATE FAILED — {len(violations)} unapproved warning(s):")
        for lineno, text in violations:
            print(f"  line {lineno}: {text}")
        print()
        print("To suppress an approved warning, add a pattern to .ci-ignore-warnings")
        print("with a comment explaining why it is accepted.")
        sys.exit(1)

    print(f"Warning gate passed ({len(lines)} lines checked, {len(ignore_patterns)} ignore patterns active)")
    sys.exit(0)


if __name__ == "__main__":
    main()
