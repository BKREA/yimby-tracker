"""Fetch a YIMBY article page through Playwright, waiting through Cloudflare's JS challenge.

We open a fresh browser context for every article: Cloudflare re-issues a stricter
challenge on follow-up navigations in the same session, and a clean context dodges
that escalation. Cost is ~5-10s per article (CF clearance), which is fine at our scale.
"""
from __future__ import annotations

from contextlib import contextmanager

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

_STEALTH_INIT = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
window.chrome = {runtime: {}};
"""


class FetchError(RuntimeError):
    pass


@contextmanager
def browser_session():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        try:
            yield browser
        finally:
            browser.close()


def fetch_article(browser, url: str, nav_timeout_ms: int = 60000, total_wait_ms: int = 60000) -> str:
    ctx = browser.new_context(
        user_agent=_UA,
        viewport={"width": 1280, "height": 900},
        locale="en-US",
    )
    ctx.add_init_script(_STEALTH_INIT)
    try:
        page = ctx.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout_ms)
        except PWTimeout:
            pass

        try:
            page.wait_for_function(
                "() => !document.title.startsWith('Just a moment')",
                timeout=total_wait_ms,
            )
        except PWTimeout as exc:
            raise FetchError(f"Cloudflare challenge never cleared for {url}") from exc

        try:
            page.wait_for_selector(".entry-content", timeout=15000)
        except PWTimeout as exc:
            raise FetchError(f"no .entry-content found at {url}") from exc

        return page.content()
    finally:
        ctx.close()
