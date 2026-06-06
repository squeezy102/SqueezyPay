"""
Diagnostic tool for testing Playwright autofill field detection against a biller login page.

Usage:
    python tools/diagnose_autofill.py <url>
    python tools/diagnose_autofill.py https://www.ameren.com/login-page/

Prints all input fields found on the page (including per-frame), shows which selectors
from the autofill logic would match, and leaves the browser open for manual inspection.
"""

import sys
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

USERNAME_SELECTORS = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[name="user"]',
    'input[name="login"]',
    'input[id*="email" i]',
    'input[id*="user" i]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
]
PASSWORD_SELECTORS = [
    'input[type="password"]',
    'input[name="password"]',
    'input[id*="password" i]',
    'input[autocomplete="current-password"]',
]


def scan_inputs(locator_source, label=""):
    inputs = locator_source.locator("input").all()
    print(f"\n--- All inputs {label}(total: {len(inputs)}) ---")
    for i, el in enumerate(inputs):
        try:
            print(
                f"  [{i}] type={el.get_attribute('type')!r:12} "
                f"id={el.get_attribute('id')!r:30} "
                f"name={el.get_attribute('name')!r:20} "
                f"autocomplete={el.get_attribute('autocomplete')!r:15} "
                f"visible={el.is_visible()}"
            )
        except Exception as e:
            print(f"  [{i}] error reading attrs: {e}")


def check_selectors(page, selectors, label):
    print(f"\n--- {label} selector scan ---")
    matched = None
    for sel in selectors:
        els = page.locator(sel).all()
        visible = [e for e in els if e.is_visible()]
        marker = " <-- WOULD USE" if (matched is None and visible) else ""
        print(f"  {sel}: {len(els)} total, {len(visible)} visible{marker}")
        if matched is None and visible:
            matched = visible[0]
            try:
                print(f"    id={matched.get_attribute('id')} name={matched.get_attribute('name')}")
            except Exception:
                pass
    if matched is None:
        print(f"  !! No match found for {label.lower()}")
    return matched


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else input("Enter URL to diagnose: ").strip()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        print(f"Navigating to {url} ...")
        try:
            page.goto(url, timeout=15000, wait_until="domcontentloaded")
            print("Page loaded. Waiting 3s for JS to settle...")
            page.wait_for_timeout(3000)
        except PWTimeout:
            print("ERROR: page load timed out")
            browser.close()
            return

        check_selectors(page, USERNAME_SELECTORS, "Username/email")
        check_selectors(page, PASSWORD_SELECTORS, "Password")
        scan_inputs(page, f"on main frame ({page.url})")

        frames = page.frames
        if len(frames) > 1:
            for i, frame in enumerate(frames[1:], 1):
                scan_inputs(frame, f"in frame [{i}] ({frame.url}) ")

        input("\nPress Enter to close browser...")
        browser.close()


if __name__ == "__main__":
    main()
