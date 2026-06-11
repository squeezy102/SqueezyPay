#!/usr/bin/env python3
"""
Coverage matrix extractor — reads all test files and prints a table of every
test scenario documented with the Option-B structured docstring standard.

Output format:
  FILE | TEST FUNCTION | SCENARIO | EP CLASS | EXPECTED

Usage:
    python scripts/coverage_matrix.py [--format text|csv|markdown] [paths...]

If no paths are given, scans backend/tests/ and frontend/src/ for test files.
"""
import argparse
import ast
import csv
import re
import sys
from pathlib import Path


# ── Option-B docstring parser ─────────────────────────────────────────────────

_SCENARIO_RE  = re.compile(r"Scenario:\s*(.+)")
_EP_RE        = re.compile(r"EP\s+class:\s*(.+)")
_EXPECTED_RE  = re.compile(r"Expected:\s*(.+)")

# Also handle TypeScript JSDoc-style /** ... */ comments
_TS_SCENARIO_RE  = re.compile(r"\*\s*Scenario:\s*(.+)")
_TS_EP_RE        = re.compile(r"\*\s*EP\s+class:\s*(.+)")
_TS_EXPECTED_RE  = re.compile(r"\*\s*Expected:\s*(.+)")


def _extract_python(path: Path) -> list[dict]:
    rows = []
    try:
        tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"))
    except SyntaxError:
        return rows

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if not node.name.startswith("test"):
            continue
        docstring = ast.get_docstring(node) or ""
        scenario  = (_SCENARIO_RE.search(docstring)  or re.search(r"", "")).group(1) if _SCENARIO_RE.search(docstring)  else ""
        ep_class  = (_EP_RE.search(docstring)        or re.search(r"", "")).group(1) if _EP_RE.search(docstring)        else ""
        expected  = (_EXPECTED_RE.search(docstring)  or re.search(r"", "")).group(1) if _EXPECTED_RE.search(docstring)  else ""
        rows.append({
            "file":     str(path),
            "test":     node.name,
            "scenario": scenario.strip(),
            "ep_class": ep_class.strip(),
            "expected": expected.strip(),
            "has_doc":  bool(scenario),
        })
    return rows


def _extract_typescript(path: Path) -> list[dict]:
    rows = []
    text = path.read_text(encoding="utf-8", errors="replace")
    # Find all it(...) / test(...) names and their preceding JSDoc block
    it_pattern = re.compile(
        r'/\*\*(.*?)\*/\s*(?:it|test)\s*\(\s*["\']([^"\']+)["\']',
        re.DOTALL,
    )
    bare_pattern = re.compile(r'(?:it|test)\s*\(\s*["\']([^"\']+)["\']')

    seen_positions = set()
    for m in it_pattern.finditer(text):
        doc_block = m.group(1)
        test_name = m.group(2)
        scenario  = (next((l for l in doc_block.splitlines() if _TS_SCENARIO_RE.search(l)), ""))
        ep_class  = (next((l for l in doc_block.splitlines() if _TS_EP_RE.search(l)),      ""))
        expected  = (next((l for l in doc_block.splitlines() if _TS_EXPECTED_RE.search(l)), ""))
        scenario  = _TS_SCENARIO_RE.search(scenario).group(1).strip()  if _TS_SCENARIO_RE.search(scenario)  else ""
        ep_class  = _TS_EP_RE.search(ep_class).group(1).strip()        if _TS_EP_RE.search(ep_class)        else ""
        expected  = _TS_EXPECTED_RE.search(expected).group(1).strip()  if _TS_EXPECTED_RE.search(expected)  else ""
        rows.append({"file": str(path), "test": test_name, "scenario": scenario, "ep_class": ep_class, "expected": expected, "has_doc": bool(scenario)})
        seen_positions.add(m.end())

    for m in bare_pattern.finditer(text):
        # Skip if this position was already captured with a docblock
        if any(abs(m.start() - p) < 200 for p in seen_positions):
            continue
        rows.append({"file": str(path), "test": m.group(1), "scenario": "", "ep_class": "", "expected": "", "has_doc": False})

    return rows


def _scan(paths: list[Path]) -> list[dict]:
    rows = []
    for path in paths:
        if path.suffix == ".py":
            rows.extend(_extract_python(path))
        elif path.suffix in (".ts", ".tsx"):
            rows.extend(_extract_typescript(path))
    return rows


def _collect_test_files(roots: list[Path]) -> list[Path]:
    files = []
    for root in roots:
        if root.is_file():
            files.append(root)
        elif root.is_dir():
            for pattern in ("test_*.py", "*.test.ts", "*.test.tsx"):
                files.extend(sorted(root.rglob(pattern)))
    return files


# ── Output formatters ─────────────────────────────────────────────────────────

def _print_text(rows: list[dict]) -> None:
    COL = [40, 55, 55, 40, 55]
    header = ["FILE", "TEST FUNCTION", "SCENARIO", "EP CLASS", "EXPECTED"]
    sep = "  ".join("-" * w for w in COL)
    fmt = "  ".join(f"{{:<{w}}}" for w in COL)
    print(fmt.format(*header))
    print(sep)
    no_doc = 0
    for r in rows:
        file_short = Path(r["file"]).name
        flag = "" if r["has_doc"] else " (!)"
        print(fmt.format(
            file_short[:COL[0]],
            (r["test"] + flag)[:COL[1]],
            r["scenario"][:COL[2]],
            r["ep_class"][:COL[3]],
            r["expected"][:COL[4]],
        ))
        if not r["has_doc"]:
            no_doc += 1
    print()
    print(f"Total: {len(rows)} tests — {len(rows) - no_doc} documented, {no_doc} missing Option-B docstring")


def _print_csv(rows: list[dict]) -> None:
    writer = csv.DictWriter(sys.stdout, fieldnames=["file", "test", "scenario", "ep_class", "expected"])
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r[k] for k in writer.fieldnames})


def _print_markdown(rows: list[dict]) -> None:
    print("| File | Test | Scenario | EP Class | Expected |")
    print("|---|---|---|---|---|")
    for r in rows:
        file_short = Path(r["file"]).name
        print(f"| {file_short} | {r['test']} | {r['scenario']} | {r['ep_class']} | {r['expected']} |")
    no_doc = sum(1 for r in rows if not r["has_doc"])
    print()
    print(f"**{len(rows)} tests — {len(rows) - no_doc} documented, {no_doc} missing Option-B docstring**")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["text", "csv", "markdown"], default="text")
    parser.add_argument("paths", nargs="*", type=Path)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    default_roots = [
        repo_root / "backend" / "tests",
        repo_root / "frontend" / "src",
    ]
    roots = args.paths if args.paths else default_roots
    files = _collect_test_files(roots)
    rows  = _scan(files)

    if args.format == "csv":
        _print_csv(rows)
    elif args.format == "markdown":
        _print_markdown(rows)
    else:
        _print_text(rows)


if __name__ == "__main__":
    main()
