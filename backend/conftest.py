import pytest
from app.main import app, rate_limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter_before_each_test():
    """
    Ensure each test starts with an isolated rate-limiting window
    so that tests do not leak request counts to other tests.
    Rate limiting remains fully active during each test execution.
    Cleanup always executes in a finally block even if a test fails.
    """
    rate_limiter.reset()
    if hasattr(app, "state") and hasattr(app.state, "rate_limiter"):
        delattr(app.state, "rate_limiter")
    try:
        yield
    finally:
        rate_limiter.reset()
        if hasattr(app, "state") and hasattr(app.state, "rate_limiter"):
            delattr(app.state, "rate_limiter")
