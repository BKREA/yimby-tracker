# YIMBY Tracker — web UI

Next.js dashboard for the scraper. Deployable to Vercel. **No GitHub PAT required** — the repo is public, so the UI fetches articles and workflow run status anonymously.

## What you get

- **Run daily scrape** / **Run backfill** — buttons that open the corresponding workflow on GitHub Actions. You click "Run workflow" there (your existing GitHub session authenticates it). One extra click, but no PAT / no in-app credentials.
- **Recent runs panel** — polls the public GitHub Actions API every 10 s, links to logs.
- **Articles** — most recent 50 records from `articles.json` (fetched via the public raw URL on GitHub).

Gate: optional HTTP Basic auth via `APP_PASSWORD` env var.

## Deploy to Vercel

### 1. Import the repo

1. <https://vercel.com/new> → Import `sethbkrea/nyc-yimby-tracker`.
2. **Root directory:** `web`.
3. **Framework Preset:** Next.js (auto-detected; if not, the bundled `vercel.json` pins it).
4. Deploy.

### 2. Environment variables

| Variable | Value |
| --- | --- |
| `GITHUB_OWNER` | `sethbkrea` |
| `GITHUB_REPO` | `nyc-yimby-tracker` |
| `APP_PASSWORD` | (optional) password for HTTP Basic auth gate. Leave unset and the app is open. |

That's all.

### 3. Redeploy after adding env vars

Env vars only apply to new builds. **Deployments → ⋯ on the latest → Redeploy**.

## Local development

```bash
cd web
cp .env.example .env.local
# Optionally set APP_PASSWORD to test the gate locally
npm install
npm run dev
# open http://localhost:3000
```

## How it all fits together

- `articles.json` lives in this public repo. Updated by GitHub Actions after each scrape.
- The Vercel UI **reads** that file via `https://raw.githubusercontent.com/sethbkrea/nyc-yimby-tracker/main/articles.json` — no auth needed.
- The Vercel UI **lists workflow runs** via `https://api.github.com/repos/sethbkrea/nyc-yimby-tracker/actions/runs` — no auth needed for public repos.
- The Vercel UI **does not trigger workflows itself.** Buttons link to GitHub's native "Run workflow" page; GitHub authenticates you via your browser session there.
