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
  const busy = activeRun !== null || pendingDispatch !== null;

  function activeLabel(): string | null {
    if (pendingDispatch === "daily-scrape.yml") return "Starting…";
    if (activeRun && activeRun.path.endsWith("daily-scrape.yml")) {
      return activeRun.status === "queued" ? "Queued on GitHub…" : "Running on GitHub…";
    }
    return null;
  }

  async function run(workflow: string) {
    if (busy) return;
    setError(null);
    onDispatch(workflow);
    const result = await dispatch({ workflow });
    if ("error" in result) {
      setError(`Failed: ${result.error}`);
      onDispatch(null);
    }
  }

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
          Pulls the RSS feed, runs each new article through Claude, appends to articles.json.
        </p>
        <button
          onClick={() => run("daily-scrape.yml")}
          disabled={busy}
          className="px-4 py-2 bg-emerald-500 text-black font-medium rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activeLabel() ?? "Run daily scrape"}
        </button>
      </section>

      <section className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-1">Historical backfill</h2>
        <p className="text-sm text-neutral-400 mb-2">
          Backfill is a local-only operation — GitHub Actions IPs are blocked by Cloudflare on
          the archive pages, but your home IP works fine.
        </p>
        <p className="text-sm text-neutral-400 mb-3">From the repo root on your machine:</p>
        <pre className="text-xs bg-neutral-950 border border-neutral-800 rounded p-3 overflow-x-auto">
{`export ANTHROPIC_API_KEY=sk-ant-...
python backfill.py --start 2025-08 --dry-run     # see plan
python backfill.py --start 2025-08               # real run (~2-4 hours)`}
        </pre>
        <p className="text-xs text-neutral-500 mt-2">
          Results commit to articles.json. The next deploy of this app will surface them.
        </p>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
