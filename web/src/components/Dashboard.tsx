"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RunButtons } from "./RunButtons";
import { RunsTable, type Run } from "./RunsTable";
import { ArticlesPreview } from "./ArticlesPreview";

const FAST_POLL_MS = 3000;
const SLOW_POLL_MS = 15000;

function isActive(r: Run): boolean {
  return r.status !== "completed";
}

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshArticles, setRefreshArticles] = useState(0);
  // True from the moment we POST a dispatch until the new run shows up.
  const [pendingDispatch, setPendingDispatch] = useState<string | null>(null);
  const seenRunIdsRef = useRef<Set<number>>(new Set());

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { runs: Run[] };
      setRuns(data.runs);
      setError(null);

      // Clear "pendingDispatch" when a new run for that workflow shows up.
      if (pendingDispatch) {
        const matching = data.runs.find(
          (r) => r.path.endsWith(pendingDispatch) && !seenRunIdsRef.current.has(r.id),
        );
        if (matching) setPendingDispatch(null);
      }

      // Track what we've already seen so a fresh dispatch is recognizable.
      data.runs.forEach((r) => seenRunIdsRef.current.add(r.id));

      // Bump article refresh whenever a run finishes successfully.
      const anyJustFinished = data.runs.some(
        (r) => r.status === "completed" && r.conclusion === "success",
      );
      if (anyJustFinished) setRefreshArticles((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [pendingDispatch]);

  // Polling cadence: fast while we have an active run OR a pending dispatch.
  useEffect(() => {
    loadRuns();
    const hasActive = (runs ?? []).some(isActive) || pendingDispatch !== null;
    const interval = setInterval(loadRuns, hasActive ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(interval);
  }, [loadRuns, runs, pendingDispatch]);

  const activeRun = (runs ?? []).find(isActive) ?? null;

  return (
    <div className="grid gap-6">
      <RunButtons
        activeRun={activeRun}
        pendingDispatch={pendingDispatch}
        onDispatch={setPendingDispatch}
      />
      <RunsTable runs={runs} error={error} onCancelled={loadRuns} />
      <ArticlesPreview refreshSignal={refreshArticles} />
    </div>
  );
}
