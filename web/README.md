# YIMBY Tracker — web UI

A small Next.js dashboard, deployable to Vercel, that drives the scraper in this repo. It does not run Playwright itself (Vercel can't); instead it triggers GitHub Actions workflows in `sethbkrea/nyc-yimby-tracker` and reads the Google Sheet for a preview.

## What you get

- **Sign in with Google** — only emails in `ALLOWED_EMAILS` can use the app.
- **Run daily scrape** — dispatches `.github/workflows/daily-scrape.yml`.
- **Run backfill** — dispatches `.github/workflows/backfill.yml` with `start_month` / `end_month` / `dry_run` inputs.
- **Recent runs panel** — polls the GitHub Actions API every 10 s, links to logs.
- **Sheet preview** — shows the most recent 25 rows from the Google Sheet plus total row count.

## Deploy to Vercel

### 1. Create the Google OAuth client

(Separate from the scraper's service account.)

1. <https://console.cloud.google.com/apis/credentials> → **Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URI: `https://<your-vercel-domain>.vercel.app/api/auth/callback/google`. After you know your Vercel URL, come back and add it; for first deploy you can guess and edit later.
4. Save → copy the **Client ID** and **Client secret**.

### 2. Create a GitHub Personal Access Token

Fine-grained, scoped to `sethbkrea/nyc-yimby-tracker`:

- **Repository access:** only `nyc-yimby-tracker`.
- **Permissions:** Actions = Read and write, Contents = Read-only, Metadata = Read-only.

Save the token (`gh_pat_...`). You'll paste it as `GH_TOKEN` below.

### 3. Import the repo to Vercel

1. <https://vercel.com/new> → Import `sethbkrea/nyc-yimby-tracker`.
2. **Root directory:** `web`.
3. Framework preset: Next.js (auto-detected).
4. Add the environment variables (see `.env.example` and the table below).
5. Deploy.

### 4. Environment variables

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | Run `openssl rand -base64 32` and paste the output. |
| `AUTH_GOOGLE_ID` | From step 1. |
| `AUTH_GOOGLE_SECRET` | From step 1. |
| `ALLOWED_EMAILS` | Comma-separated allow-list of Google account emails. Must include your own. |
| `GITHUB_OWNER` | `sethbkrea` |
| `GITHUB_REPO` | `nyc-yimby-tracker` |
| `GH_TOKEN` | The PAT from step 2. |
| `SHEET_ID` | `1jq9glIzTnc8usXPy96jpm3WObOkXbDfZBlMTtUQNFkY` |
| `SHEET_TAB` | `Sheet1` (or whatever you named the tab) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Inline contents of the service-account JSON — same value as the GitHub Actions secret. |

### 5. Wire the redirect URI back

Once Vercel gives you the live URL, edit the Google OAuth client and set the authorized redirect URI to `https://<that-url>/api/auth/callback/google`.

## Local development

```bash
cd web
cp .env.example .env.local        # fill in real values
npm install
npm run dev
# open http://localhost:3000
```

For local OAuth, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in the Google OAuth client.

## Notes

- Sheet preview is read via the **service account**, not the user's Google session — the user OAuth is purely an identity gate. This keeps the data flow consistent with how the scraper writes (and avoids needing to ask the user for extra Sheets scope).
- The dispatch endpoint allow-lists exactly two workflow files. Anything else returns 400 — even with a valid session, you can't trigger arbitrary workflows.
- Backfill has a 6-hour GitHub Actions hard cap. If you ever need to backfill more than ~3-4 years at once, split the date range across runs.
