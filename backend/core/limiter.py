from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _rate_limit_key(request: Request) -> str:
    """
    Per-test bucket isolation: tests pass X-Test-Rate-Key with a unique UUID
    so each test fixture gets its own rate-limit counter without disabling limits.
    Falls back to remote address for production requests.
    The header is only honoured when SQUEEZYPAY_TESTING is set so it cannot be
    used to bypass rate limits in a production deployment.
    """
    import os
    if os.environ.get("SQUEEZYPAY_TESTING"):
        test_key = request.headers.get("X-Test-Rate-Key")
        if test_key:
            return test_key
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)
