"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RunButtons } from "./RunButtons";
import { RunsTable, type Run } from "./RunsTable";
import { ArticlesPreview, type RelatedNews } from "./ArticlesPreview";
import { SummaryStats } from "./SummaryStats";
import type { Article } from "@/lib/articles";

// Cadence chosen to be friendly to GitHub's API limits. /api/runs hits the
// authenticated GitHub API (5000/hr) plus the raw URL (cached 60s server-side),
// so these intervals × however many tabs you have open should stay well under.
const FAST_POLL_MS = 5000;  // active run in progress — every 5s feels live enough
const SLOW_POLL_MS = 60000; // idle — once a minute is plenty

function isActive(r: Run): boolean {
  return r.status !== "completed";
}

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [refreshArticles, setRefreshArticles] = useState(0);
  const [relatedNews, setRelatedNews] = useState<RelatedNews>({});
  // Single source of the article corpus, shared by SummaryStats + ArticlesPreview
  // so the Dashboard makes ONE /api/articles call instead of one per component.
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [articlesTotal, setArticlesTotal] = useState<number | null>(null);
  const [articlesError, setArticlesError] = useState<string | null>(null);
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
      const data = (await res.json()) as { runs: Run[]; note?: string };
      setRuns(data.runs);
      setNote(data.note ?? null);
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

  // Load the article corpus once on mount and again whenever a run finishes.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/articles")
      .then(async (r) => {
        if (!r.ok) {
          const b = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(b.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ articles: Article[]; total: number }>;
      })
      .then((d) => {
        if (!cancelled) {
          setArticles(d.articles);
          setArticlesTotal(d.total);
          setArticlesError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setArticlesError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [refreshArticles]);

  // Related news loads once on mount and again whenever articles refresh
  // (a fresh enrichment workflow run will have updated the file).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/related-news")
      .then((r) => (r.ok ? r.json() : { byAddress: {} }))
      .then((d) => {
        if (!cancelled) setRelatedNews(d.byAddress ?? {});
      })
      .catch(() => {
        // Gracefully ignore — UI just won't show related counts.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshArticles]);

  const activeRun = (runs ?? []).find(isActive) ?? null;

  return (
    <div className="grid gap-6">
      <SummaryStats articles={articles} error={articlesError} relatedNews={relatedNews} />
      <RunButtons
        activeRun={activeRun}
        pendingDispatch={pendingDispatch}
        onDispatch={setPendingDispatch}
      />
      <RunsTable runs={runs} error={error} note={note} onCancelled={loadRuns} />
      <ArticlesPreview
        articles={articles}
        total={articlesTotal}
        error={articlesError}
        runs={runs ?? []}
        relatedNews={relatedNews}
      />
    </div>
  );
}
