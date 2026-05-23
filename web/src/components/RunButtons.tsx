"use client";

import { useState } from "react";
import type { Run } from "./RunsTable";

type DispatchBody = {
  workflow: string;
  inputs?: Record<string, string | boolean>;
};

async function dispatch(body: DispatchBody): Promise<{ ok: true } | { error: string }> {
  const res = await fetch("/api/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { error: data.error ?? `HTTP ${res.status}` };
}

interface Props {
  activeRun: Run | null;
  pendingDispatch: string | null;
  onDispatch: (workflow: string | null) => void;
}

export function RunButtons({ activeRun, pendingDispatch, onDispatch }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [startMonth, setStartMonth] = useState("2025-08");
  const [endMonth, setEndMonth] = useState("");
  const [dryRun, setDryRun] = useState(false);

  // Any-run-in-flight: covers both a real active run AND our local "just clicked,
  // waiting for GitHub to register it" state. Both block new clicks.
  const busy = activeRun !== null || pendingDispatch !== null;

  function activeLabelFor(workflow: string): string | null {
    if (pendingDispatch === workflow) return "Starting…";
    if (activeRun && activeRun.path.endsWith(workflow)) {
      return activeRun.status === "queued" ? "Queued on GitHub…" : "Running on GitHub…";
    }
    return null;
  }

  async function run(workflow: string, inputs?: Record<string, string | boolean>) {
    if (busy) return;
    setError(null);
    onDispatch(workflow);
    const result = await dispatch({ workflow, inputs });
    if ("error" in result) {
      setError(`Failed: ${result.error}`);
      onDispatch(null);
    }
  }

  const dailyLabel = activeLabelFor("daily-scrape.yml");
  const backfillLabel = activeLabelFor("backfill.yml");

  return (
    <div className="space-y-6">
      {activeRun && (
        <div className="border border-sky-500/40 bg-sky-500/10 rounded-lg p-3 text-sm text-sky-200">
          A run is currently {activeRun.status === "queued" ? "queued" : "in progress"}:{" "}
          <strong>{activeRun.name}</strong>. New runs are disabled until it finishes — you can{" "}
          <a
            href={activeRun.url}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-white"
          >
            view its logs
          </a>{" "}
          or cancel it in the table below.
        </div>
      )}

      <section className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-1">Daily scrape</h2>
        <p className="text-sm text-neutral-400 mb-4">
          Pulls the RSS feed, parses new articles, appends to articles.json.
        </p>
        <button
          onClick={() => run("daily-scrape.yml")}
          disabled={busy}
          className="px-4 py-2 bg-emerald-500 text-black font-medium rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dailyLabel ?? "Run daily scrape"}
        </button>
      </section>

      <section className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-1">Historical backfill</h2>
        <p className="text-sm text-neutral-400 mb-4">
          Crawls month-archive pages between the given months. Runs up to 5h50m.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-sm">
            <span className="block text-neutral-400 mb-1">Start month (YYYY-MM)</span>
            <input
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5"
              placeholder="2025-08"
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            <span className="block text-neutral-400 mb-1">End month (blank = now)</span>
            <input
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5"
              placeholder="2026-05"
              disabled={busy}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={busy}
          />
          Dry run (collect URLs only, no writes)
        </label>
        <button
          onClick={() =>
            run("backfill.yml", {
              start_month: startMonth,
              end_month: endMonth,
              dry_run: dryRun,
            })
          }
          disabled={busy || !/^\d{4}-\d{2}$/.test(startMonth)}
          className="px-4 py-2 bg-sky-500 text-black font-medium rounded hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {backfillLabel ?? "Run backfill"}
        </button>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
