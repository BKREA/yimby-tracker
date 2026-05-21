# nyc-yimby-tracker

Scrapes [newyorkyimby.com](https://newyorkyimby.com/) daily via an RSS.app feed and appends new development articles to a Google Sheet.

For every new article the scraper extracts:

| Column | Source |
| --- | --- |
| **Address** | parsed from article title / first body sentence |
| **Developer** | parsed from body ("X is listed as the owner/applicant") |
| **Link** | RSS feed link |
| **Neighborhood** | parsed from title; URL slug fallback |
| **Borough** | parsed from title; URL slug fallback (canonical: Manhattan / Brooklyn / Queens / Staten Island / The Bronx) |
| **Notes** | floors, height, square footage, unit count, architect — extracted via regex |
| **Complete Article** | full body text from `.entry-content` |

The Cloudflare JS challenge on newyorkyimby.com is cleared with headless Chromium (Playwright). RSS.app provides article discovery; Playwright provides full article HTML.

## How it runs

A GitHub Actions cron (`.github/workflows/daily-scrape.yml`) runs `python scrape.py` once a day. The script:

1. Reads the existing **Link** column from the sheet → set of URLs already recorded.
2. Pulls the RSS.app feed → list of recent article URLs.
3. Filters: keeps items whose link is not in the sheet *and* whose `pubDate` is within the last `MAX_AGE_DAYS` (default 30).
4. For each remaining URL: opens a fresh Playwright context (Cloudflare re-challenges on follow-up navigations in the same context), waits for the challenge to clear, extracts fields, queues a row.
5. Appends all new rows to the sheet in one batch, oldest first.

## One-time setup

### 1. Create a Google Cloud service account

This account's email needs read+write access to the target Google Sheet.

1. Go to <https://console.cloud.google.com/>. If you don't have a project yet, create one (any name, e.g. `yimby-tracker`).
2. **Enable the Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable.
3. **Create the service account**: APIs & Services → Credentials → Create credentials → Service account.
   - Name: `yimby-sheets-writer` (or anything).
   - Skip the optional role / user grants — close the wizard.
4. **Create a JSON key**: open the service account → Keys tab → Add key → Create new key → JSON → Download.
   - This downloads a file like `yimby-tracker-abc123.json`. Keep it safe; you'll paste its contents into a GitHub Actions secret.
5. **Share the sheet** ([this sheet](https://docs.google.com/spreadsheets/d/1jq9glIzTnc8usXPy96jpm3WObOkXbDfZBlMTtUQNFkY/edit)) with the service account's email (looks like `yimby-sheets-writer@yimby-tracker.iam.gserviceaccount.com`) as an **Editor**.

### 2. Configure GitHub Actions secrets

In the repo: Settings → Secrets and variables → Actions → New repository secret. Add three:

| Secret name | Value |
| --- | --- |
| `YIMBY_FEED_URL` | `https://rss.app/feeds/ArDtOYRExEskqNMj.xml` |
| `SHEET_ID` | `1jq9glIzTnc8usXPy96jpm3WObOkXbDfZBlMTtUQNFkY` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the entire contents of the JSON key file (paste it raw) |

Optional repo **variables** (Settings → Secrets and variables → Actions → Variables tab):

| Variable | Default | Notes |
| --- | --- | --- |
| `SHEET_TAB` | `Sheet1` | If your tab is named something else, set it here. |
| `MAX_AGE_DAYS` | `30` | Ignore feed items older than this. |

### 3. Run it once by hand

Actions → "Daily YIMBY scrape" → Run workflow. Check that the run succeeds and new rows appear in the sheet. After that the cron handles it.

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

export YIMBY_FEED_URL='https://rss.app/feeds/ArDtOYRExEskqNMj.xml'
export SHEET_ID='1jq9glIzTnc8usXPy96jpm3WObOkXbDfZBlMTtUQNFkY'
export GOOGLE_SERVICE_ACCOUNT_FILE='/path/to/service-account.json'
python scrape.py
```

## Files

```
scrape.py     entrypoint — orchestration, dedupe, polite delays
feed.py       parse the RSS.app feed → (url, pub_datetime) items
article.py    Playwright wrapper — fresh context per article to clear Cloudflare
extract.py    regex-based parsing of address / developer / location / notes
sheets.py     Google Sheets read+append client
.github/workflows/daily-scrape.yml   cron schedule
```

## Notes & limitations

- **One context per article.** Cloudflare returns a stricter JS challenge on follow-up navigations in the same browser session. Opening a fresh context for every article costs ~5s of CF clearance time but is reliable.
- **No historical backfill beyond the feed.** RSS.app returns ~25 recent items (~6 days). If you need older articles, you'd need to crawl `/YYYY/MM/` archive pages — not currently implemented.
- **Best-effort extraction.** The Developer and Notes fields are regex-based on YIMBY's writing patterns. Articles that deviate (e.g. a permit-status update with no project specs) will have empty fields; the full text remains in **Complete Article** so nothing is lost.
