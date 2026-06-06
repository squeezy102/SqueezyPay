"""
Launched as a detached subprocess by the autofill endpoint.
Receives url, username, password as CLI args (base64-encoded to avoid shell quoting issues).
Opens a headed Chromium window, fills the login fields, and stays open.
Exits with code 0 on success, 1 on failure.
"""
import sys
import base64
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

def main():
    if len(sys.argv) != 4:
        sys.exit(1)

    url      = base64.b64decode(sys.argv[1]).decode()
    username = base64.b64decode(sys.argv[2]).decode()
    password = base64.b64decode(sys.argv[3]).decode()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        try:
            page.goto(url, timeout=15000, wait_until="domcontentloaded")
        except PWTimeout:
            sys.exit(1)

        username_field = None
        for sel in USERNAME_SELECTORS:
            try:
                el = page.locator(sel).first
                if el.count() > 0 and el.is_visible():
                    username_field = el
                    break
            except Exception:
                continue

        if username_field is None:
            sys.exit(1)

        password_field = None
        for sel in PASSWORD_SELECTORS:
            try:
                el = page.locator(sel).first
                if el.count() > 0 and el.is_visible():
                    password_field = el
                    break
            except Exception:
                continue

        if password_field is None:
            sys.exit(1)

        username_field.fill(username)
        password_field.fill(password)

        if username_field.input_value() != username or password_field.input_value() != password:
            sys.exit(1)

        # Fields filled — block here so the browser stays open until the user closes it
        page.wait_for_event("close", timeout=0)
        sys.exit(0)

if __name__ == "__main__":
    main()
