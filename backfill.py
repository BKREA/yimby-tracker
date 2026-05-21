"""One-off historical backfill. Crawls /YYYY/MM/page/N/ archives and writes any
missing articles to the sheet.

Usage:
  python backfill.py --start 2025-08
  python backfill.py --start 2025-08 --end 2026-05

Runs locally only — the per-article rate (~5-10s through Cloudflare) means a
full year backfill takes hours, beyond the GitHub Actions job limit.

Safe to interrupt: each batch is appended to the sheet immediately, and re-running
skips URLs already present.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import date

from bs4 import BeautifulSoup

from article import FetchError, browser_session, fetch_archive, fetch_article
from extract import parse_article
from sheets import Sheet
from scrape import _env

ARTICLE_RE = re.compile(r"https?://newyorkyimby\.com/(\d{4})/(\d{2})/[a-z0-9-]+\.html$")
TOTAL_PAGES_RE = re.compile(r"Page\s+\d+\s+of\s+(\d+)", re.IGNORECASE)

BATCH_SIZE = 25


def _iter_months(start: tuple[int, int], end: tuple[int, int]):
    y, m = start
    while (y, m) <= end:
        yield y, m
        m += 1
        if m == 13:
            m = 1
            y += 1


def _parse_yyyy_mm(s: str) -> tuple[int, int]:
    y, m = s.split("-")
    return int(y), int(m)


def collect_month_urls(browser, year: int, month: int) -> list[str]:
    """Return all in-month article URLs for /YYYY/MM/."""
    base = f"https://newyorkyimby.com/{year}/{month:02d}/"
    print(f"[{year}-{month:02d}] crawling archive…")

    first_html = fetch_archive(browser, base)
    soup = BeautifulSoup(first_html, "lxml")
    title = soup.title.string if soup.title else ""
    total_pages = 1
    m = TOTAL_PAGES_RE.search(title)
    if m:
        total_pages = int(m.group(1))
    else:
        # Page 1 of N is sometimes only shown from page 2 onward; try /page/2/.
        try:
            page2 = fetch_archive(browser, base + "page/2/")
            soup2 = BeautifulSoup(page2, "lxml")
            title2 = soup2.title.string if soup2.title else ""
            m2 = TOTAL_PAGES_RE.search(title2)
            if m2:
                total_pages = int(m2.group(1))
        except FetchError:
            pass

    print(f"[{year}-{month:02d}] {total_pages} archive page(s)")

    urls: list[str] = []
    seen: set[str] = set()

    def _absorb(html: str) -> int:
        added = 0
        s = BeautifulSoup(html, "lxml")
        for a in s.find_all("a", href=True):
            href = a["href"]
            m = ARTICLE_RE.match(href)
            if m and int(m.group(1)) == year and int(m.group(2)) == month and href not in seen:
                seen.add(href)
                urls.append(href)
                added += 1
        return added

    _absorb(first_html)
    for page in range(2, total_pages + 1):
        try:
            html = fetch_archive(browser, f"{base}page/{page}/")
        except FetchError:
            # 404 or transient: assume we've run past the real pagination.
            break
        added = _absorb(html)
        if added == 0:
            # No new in-month URLs => past the end of real content.
            break
        time.sleep(0.5)

    print(f"[{year}-{month:02d}] {len(urls)} unique article URLs")
    return urls


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True, help="YYYY-MM (inclusive)")
    ap.add_argument("--end", default=None, help="YYYY-MM (inclusive). Defaults to current month.")
    ap.add_argument("--dry-run", action="store_true", help="Collect URLs but don't fetch/write articles")
    args = ap.parse_args()

    start = _parse_yyyy_mm(args.start)
    if args.end:
        end = _parse_yyyy_mm(args.end)
    else:
        today = date.today()
        end = (today.year, today.month)

    sheet_id = _env("SHEET_ID", required=True)
    sheet_tab = _env("SHEET_TAB", "Sheet1")

    sheet = Sheet(sheet_id, sheet_tab)
    sheet.ensure_header()
    existing = sheet.existing_links()
    print(f"[sheet] {len(existing)} existing links")

    with browser_session() as browser:
        all_urls: list[str] = []
        for y, m in _iter_months(start, end):
            month_urls = collect_month_urls(browser, y, m)
            all_urls.extend(month_urls)

        new_urls = [u for u in all_urls if u not in existing]
        print(f"[plan] {len(all_urls)} URLs found, {len(new_urls)} new (after dedupe)")

        if args.dry_run or not new_urls:
            return 0

        batch: list[list[str]] = []
        failures: list[tuple[str, str]] = []
        t_start = time.time()
        for i, url in enumerate(new_urls, 1):
            elapsed = time.time() - t_start
            avg = elapsed / max(i - 1, 1)
            eta = avg * (len(new_urls) - i)
            print(f"[{i}/{len(new_urls)}] ({eta/60:.1f}m eta) {url}")
            try:
                html = fetch_article(browser, url)
                article = parse_article(html, url)
                batch.append(article.as_row())
            except Exception as exc:  # noqa: BLE001
                print(f"  failed: {exc}", file=sys.stderr)
                failures.append((url, str(exc)))

            if len(batch) >= BATCH_SIZE:
                sheet.append_rows(batch)
                print(f"[sheet] appended {len(batch)} rows")
                batch.clear()
            time.sleep(1.5)

        if batch:
            sheet.append_rows(batch)
            print(f"[sheet] appended {len(batch)} final rows")

    if failures:
        print(f"[done] {len(failures)} failed", file=sys.stderr)
        return 1
    print("[done]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
