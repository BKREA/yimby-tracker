"""Entrypoint: pull RSS feed, fetch new articles via Playwright, append to Google Sheet.

Environment variables:
  YIMBY_FEED_URL                RSS.app feed URL (required)
  SHEET_ID                      Google Sheet ID (required)
  SHEET_TAB                     Sheet tab name (default: Sheet1)
  GOOGLE_SERVICE_ACCOUNT_JSON   Inline service-account JSON (preferred for GH Actions)
  GOOGLE_SERVICE_ACCOUNT_FILE   Path to service-account JSON (local dev)
  MAX_AGE_DAYS                  Skip feed items older than this (default: 30)
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone

from article import browser_session, fetch_article
from extract import parse_article
from feed import load_feed
from sheets import Sheet


def _env(name: str, default: str | None = None, required: bool = False) -> str:
    val = os.environ.get(name, default)
    if required and not val:
        print(f"error: ${name} is required", file=sys.stderr)
        sys.exit(2)
    return val or ""


def main() -> int:
    feed_url = _env("YIMBY_FEED_URL", required=True)
    sheet_id = _env("SHEET_ID", required=True)
    sheet_tab = _env("SHEET_TAB", "Sheet1")
    max_age_days = int(_env("MAX_AGE_DAYS", "30"))

    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)

    sheet = Sheet(sheet_id, sheet_tab)
    sheet.ensure_header()
    seen = sheet.existing_links()
    print(f"[sheet] {len(seen)} existing links")

    feed_items = load_feed(feed_url)
    print(f"[feed] {len(feed_items)} items")

    # Oldest first so the sheet stays chronological on append.
    candidates = sorted(
        (it for it in feed_items if it.url not in seen and it.published >= cutoff),
        key=lambda it: it.published,
    )
    print(f"[plan] {len(candidates)} new articles to scrape")
    if not candidates:
        return 0

    rows: list[list[str]] = []
    failures: list[tuple[str, str]] = []
    with browser_session() as browser:
        for i, item in enumerate(candidates, 1):
            print(f"[{i}/{len(candidates)}] {item.url}")
            try:
                html = fetch_article(browser, item.url)
                article = parse_article(html, item.url)
                rows.append(article.as_row())
            except Exception as exc:  # noqa: BLE001
                print(f"  failed: {exc}", file=sys.stderr)
                failures.append((item.url, str(exc)))
            time.sleep(1.5)  # polite delay between page loads

    if rows:
        sheet.append_rows(rows)
        print(f"[sheet] appended {len(rows)} rows")

    if failures:
        print(f"[done] {len(rows)} appended, {len(failures)} failed", file=sys.stderr)
        return 1
    print(f"[done] {len(rows)} appended")
    return 0


if __name__ == "__main__":
    sys.exit(main())
