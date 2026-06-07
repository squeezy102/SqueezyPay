"""
Launched as a detached subprocess by the autofill endpoint.
Navigates to the biller login page, attempts to fill username/password fields,
and verifies success. If the first attempt fails and the user has not yet
interacted with the page, tries once more. Abandons silently if the user
has begun manual entry or if both attempts fail.
"""
import base64
import sys
import threading

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

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


def user_has_interacted(page, username_sel: str, password_sel: str) -> bool:
    """Returns True if the user has focused or typed in either field."""
    try:
        return page.evaluate("""
            ([uSel, pSel]) => {
                const active = document.activeElement;
                const uEl = document.querySelector(uSel);
                const pEl = document.querySelector(pSel);
                const focused = active === uEl || active === pEl;
                const hasValue = (uEl && uEl.value.length > 0) || (pEl && pEl.value.length > 0);
                return focused || hasValue;
            }
        """, [username_sel, password_sel])
    except Exception:
        return False


def find_field(page, selectors: list[str]):
    """Returns the first visible matching locator, or None."""
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.count() > 0 and el.is_visible():
                return el, sel
        except Exception:
            continue
    return None, None


def attempt_fill(page, username: str, password: str):
    """
    Try to locate and fill both fields.
    Returns (success, username_sel, password_sel).
    """
    u_field, u_sel = find_field(page, USERNAME_SELECTORS)
    if u_field is None:
        return False, None, None

    p_field, p_sel = find_field(page, PASSWORD_SELECTORS)
    if p_field is None:
        return False, None, None

    u_field.fill(username)
    p_field.fill(password)

    filled = (u_field.input_value() == username and p_field.input_value() == password)
    return filled, u_sel, p_sel


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
            page.goto(url, timeout=15000, wait_until="networkidle")
        except PWTimeout:
            sys.exit(1)

        # First attempt
        filled, u_sel, p_sel = attempt_fill(page, username, password)

        if not filled:
            # Check whether the user has already started interacting
            if u_sel and p_sel and user_has_interacted(page, u_sel, p_sel):
                # User is already typing — step aside
                pass
            else:
                # Wait briefly and try once more
                page.wait_for_timeout(1500)
                if u_sel and p_sel and user_has_interacted(page, u_sel, p_sel):
                    pass  # User started typing during the wait — abandon
                else:
                    filled, u_sel, p_sel = attempt_fill(page, username, password)

        # Whether or not fill succeeded, leave the browser open for the user
        done = threading.Event()
        browser.on("disconnected", lambda: done.set())
        done.wait()

    sys.exit(0 if filled else 1)


if __name__ == "__main__":
    main()
