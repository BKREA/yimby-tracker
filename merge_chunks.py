"""Merge per-chunk related_news.chunk*.json files into related_news.json.

Used by the chunked enrichment workflow: each parallel chunk writes its own
file, then a final job runs this to consolidate before committing.

Idempotent — re-running picks up whatever chunk files exist; missing chunks
just leave their slice of addresses untouched.
"""
from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

MAIN_FILE = Path("related_news.json")


def _read(path: Path) -> dict:
    if not path.exists() or path.stat().st_size == 0:
        return {"articles": [], "address_refresh_dates": {}}
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def main() -> int:
    main_store = _read(MAIN_FILE)
    main_store.setdefault("articles", [])
    main_store.setdefault("address_refresh_dates", {})

    existing_urls = {r.get("url") for r in main_store["articles"] if r.get("url")}

    chunk_files = sorted(glob.glob("related_news.chunk*.json"))
    if not chunk_files:
        print("[merge] no chunk files found — nothing to do")
        return 0

    print(f"[merge] {len(chunk_files)} chunk file(s)")
    added = 0
    refreshed = 0
    for path in chunk_files:
        chunk = _read(Path(path))
        for rec in chunk.get("articles", []) or []:
            url = rec.get("url")
            if not url or url in existing_urls:
                continue
            main_store["articles"].append(rec)
            existing_urls.add(url)
            added += 1
        for addr, ts in (chunk.get("address_refresh_dates") or {}).items():
            prev = main_store["address_refresh_dates"].get(addr, "")
            if ts > prev:
                main_store["address_refresh_dates"][addr] = ts
                refreshed += 1
        print(f"  {path}: +{len(chunk.get('articles', [])) or 0} candidates")

    _write(MAIN_FILE, main_store)
    print(
        f"[merge] done — appended {added} new records, "
        f"refreshed {refreshed} address timestamps"
    )

    # Expose for the workflow's commit-message step.
    import os
    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        with open(gh_output, "a", encoding="utf-8") as f:
            f.write(f"added={added}\n")
            f.write(f"chunks={len(chunk_files)}\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
