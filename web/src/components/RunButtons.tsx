"use client";

import type { DashboardLinks } from "./Dashboard";

export function RunButtons({ links }: { links: DashboardLinks }) {
  return (
    <div className="space-y-6">
      <section className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-1">Daily scrape</h2>
        <p className="text-sm text-neutral-400 mb-4">
          Pulls the RSS feed, fetches any new articles, appends to articles.json.
        </p>
        <a
          href={links.dailyScrape}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2 bg-emerald-500 text-black font-medium rounded hover:bg-emerald-400"
        >
          Run daily scrape ↗
        </a>
        <p className="text-xs text-neutral-500 mt-2">
          Opens GitHub Actions. Click the “Run workflow” button on that page to trigger.
        </p>
      </section>

      <section className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-1">Historical backfill</h2>
        <p className="text-sm text-neutral-400 mb-4">
          Crawls month-archive pages between the given months. Runs up to 5h50m.
        </p>
        <a
          href={links.backfill}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2 bg-sky-500 text-black font-medium rounded hover:bg-sky-400"
        >
          Run backfill ↗
        </a>
        <p className="text-xs text-neutral-500 mt-2">
          Opens GitHub Actions. On that page click “Run workflow”, enter start_month / end_month, and submit.
        </p>
      </section>
    </div>
  );
}
