#!/usr/bin/env python3
"""Historical backfill via Anthropic's Message Batches API — 50% cheaper.

Pipeline per chunk (resumable — finished chunks are written before the next):
  1. Scrape article pages with Playwright (sequential; Cloudflare-gated).
  2. Send the whole chunk's extractions to the Batch API in one request
     (50% off list price, stacked with prompt caching).
  3. Poll until the batch ends, retrieve results, append to articles.json.

Cost lever vs. backfill.py (sync): Batch = 0.5x. With caching, ~$0.0009/article.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  .venv/bin/python backfill_batch.py --start 2017-01 --end 2017-12
  .venv/bin/python backfill_batch.py --start 2024-01 --end 2024-12 --chunk 300
  .venv/bin/python backfill_batch.py --start 2017-01 --dry-run   # count only, free
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone

from anthropic import Anthropic

from article import FetchError, browser_session, fetch_article
from backfill import _iter_months, _parse_yyyy_mm, collect_month_urls
from extract_llm import (
    DEFAULT_MODEL, batch_request, build_article_record, cache_stats,
    parse_article_fields, parse_save_article, record_usage,
)
from store import Store

POLL_SECONDS = 15
MAX_POLLS = 480  # ~2h safety cap per chunk


def collect_urls(start, end, seen) -> list[str]:
    urls: list[str] = []
    with browser_session() as b:
        for y, m in _iter_months(start, end):
            try:
                month_urls = collect_month_urls(b, y, m)
            except Exception as e:  # noqa: BLE001
                print(f"[{y}-{m:02d}] crawl failed: {e}", file=sys.stderr)
                continue
            new = [u for u in month_urls if u not in seen]
            print(f"[{y}-{m:02d}] {len(month_urls)} urls, {len(new)} new")
            urls.extend(new)
    out, dedup = [], set()
    for u in urls:
        if u not in dedup:
            dedup.add(u)
            out.append(u)
    return out


def run_batch(client: Anthropic, reqs: list[dict], items: dict) -> list[dict]:
    """Submit one batch, poll to completion, return article records."""
    batch = client.messages.batches.create(requests=reqs)
    print(f"  batch {batch.id} submitted ({len(reqs)} requests)")
    for _ in range(MAX_POLLS):
        bs = client.messages.batches.retrieve(batch.id)
        if bs.processing_status == "ended":
            break
        print(f"  …{bs.processing_status} {getattr(bs, 'request_counts', '')}")
        time.sleep(POLL_SECONDS)
    else:
        print("  ! batch did not finish within cap; leaving for a re-run", file=sys.stderr)
        return []

    records = []
    now = datetime.now(timezone.utc).isoformat()
    for r in client.messages.batches.results(batch.id):
        if r.result.type != "succeeded":
            print(f"  result {r.custom_id}: {r.result.type}", file=sys.stderr)
            continue
        msg = r.result.message
        record_usage(getattr(msg, "usage", None))
        try:
            fields = parse_save_article(msg.content)
        except Exception as e:  # noqa: BLE001
            print(f"  parse fail {r.custom_id}: {e}", file=sys.stderr)
            continue
        url, title, body, published = items[r.custom_id]
        records.append(build_article_record(url, now, title, body, published, fields).as_record())
    return records


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True, help="YYYY-MM")
    ap.add_argument("--end", help="YYYY-MM (default = start month)")
    ap.add_argument("--chunk", type=int, default=300, help="articles scraped + batched per cycle")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true", help="crawl + count only; no scrape, no API")
    args = ap.parse_args()

    start = _parse_yyyy_mm(args.start)
    end = _parse_yyyy_mm(args.end) if args.end else start

    store = Store()
    seen = store.existing_links()
    print(f"[store] {len(seen)} existing articles")

    urls = collect_urls(start, end, seen)
    if args.limit:
        urls = urls[: args.limit]
    print(f"[plan] {len(urls)} new articles in range")
    if args.dry_run:
        print("[dry-run] stopping before scrape/LLM. Re-run without --dry-run to execute.")
        return 0
    if not urls:
        return 0

    client = Anthropic()
    total = 0
    with browser_session() as b:
        for ci in range(0, len(urls), args.chunk):
            chunk = urls[ci : ci + args.chunk]
            print(f"\n=== chunk {ci // args.chunk + 1} / {(len(urls) + args.chunk - 1) // args.chunk}: {len(chunk)} urls ===")
            items, reqs = {}, []
            for j, u in enumerate(chunk):
                cid = f"a{j}"
                try:
                    html = fetch_article(b, u)
                    title, body, published = parse_article_fields(html, u)
                    if not body:
                        print(f"  skip (no body) {u}", file=sys.stderr)
                        continue
                    items[cid] = (u, title, body, published)
                    reqs.append(batch_request(cid, title, body))
                except FetchError as e:
                    print(f"  scrape fail {u}: {e}", file=sys.stderr)
            if not reqs:
                print("  nothing scraped in chunk; skipping")
                continue
            print(f"  scraped {len(reqs)} → batch")
            records = run_batch(client, reqs, items)
            added = store.append_records(records)
            total += added
            print(f"  appended {added} (extracted {len(records)})")

    cs = cache_stats()
    print(f"\n[done] added {total} articles")
    if cs["calls"]:
        print(
            f"[cache] {cs['calls']} extractions | cache_read={cs['cache_read']} "
            f"write={cs['cache_write']} uncached_in={cs['uncached_input']} out={cs['output']} "
            f"(billed at 50% — Batch API)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
