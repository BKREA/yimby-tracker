"""Fetch YIMBY pages through Playwright, waiting through Cloudflare's JS challenge.

We open a fresh browser context for every page: Cloudflare re-issues a stricter
challenge on follow-up navigations in the same session, and a clean context dodges
that escalation. Cost is ~5-10s per page (CF clearance), which is fine at our scale.
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


def _fetch_page(
    browser,
    url: str,
    wait_selector: str | None,
    nav_timeout_ms: int = 60000,
    cf_wait_ms: int = 60000,
    selector_timeout_ms: int = 15000,
) -> str:
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
                timeout=cf_wait_ms,
            )
        except PWTimeout as exc:
            raise FetchError(f"Cloudflare challenge never cleared for {url}") from exc

        if wait_selector:
            try:
                page.wait_for_selector(wait_selector, timeout=selector_timeout_ms, state="attached")
            except PWTimeout as exc:
                raise FetchError(f"selector {wait_selector!r} not found at {url}") from exc

        return page.content()
    finally:
        ctx.close()


def fetch_article(browser, url: str) -> str:
    return _fetch_page(browser, url, wait_selector=".entry-content")


def fetch_archive(browser, url: str) -> str:
    # Archive pages list posts; #content or article cards always render.
    return _fetch_page(browser, url, wait_selector="a[href*='newyorkyimby.com/']")


def fetch_xml(browser, url: str) -> str:
    """Fetch an XML resource (sitemap) through Playwright's context.request so
    Cloudflare cookies set during prior navigation apply. Returns raw text.
    """
    ctx = browser.new_context(
        user_agent=_UA,
        viewport={"width": 1280, "height": 900},
        locale="en-US",
    )
    ctx.add_init_script(_STEALTH_INIT)
    try:
        # Warm a clearance cookie by visiting the site root first.
        page = ctx.new_page()
        try:
            page.goto("https://newyorkyimby.com/", wait_until="domcontentloaded", timeout=60000)
        except PWTimeout:
            pass
        try:
            page.wait_for_function(
                "() => !document.title.startsWith('Just a moment')",
                timeout=60000,
            )
        except PWTimeout as exc:
            raise FetchError(f"Cloudflare challenge never cleared (warmup)") from exc

        # Now use context.request — carries CF cookies, but returns raw response.
        resp = ctx.request.get(url, timeout=60000)
        if not resp.ok:
            raise FetchError(f"GET {url} returned {resp.status}")
        return resp.text()
    finally:
        ctx.close()
