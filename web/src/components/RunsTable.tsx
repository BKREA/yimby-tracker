"use client";

import { useEffect, useState, useCallback } from "react";

interface Run {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
  event: string;
  createdAt: string;
  updatedAt: string;
  path: string;
}

function badge(status: string, conclusion: string | null): { label: string; className: string } {
  if (status !== "completed") {
    return { label: status, className: "bg-amber-500/20 text-amber-300" };
  }
  if (conclusion === "success") return { label: "success", className: "bg-emerald-500/20 text-emerald-300" };
  if (conclusion === "failure") return { label: "failure", className: "bg-red-500/20 text-red-300" };
  if (conclusion === "cancelled") return { label: "cancelled", className: "bg-neutral-500/20 text-neutral-300" };
  return { label: conclusion ?? "—", className: "bg-neutral-500/20 text-neutral-300" };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function RunsTable({ refreshSignal }: { refreshSignal: number }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { runs: Run[] };
      setRuns(data.runs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load, refreshSignal]);

  return (
    <section className="border border-neutral-800 rounded-lg p-5 bg-neutral-900/40">
      <h2 className="text-lg font-semibold mb-3">Recent runs</h2>
      {error && <p className="text-sm text-red-400 mb-3">Error: {error}</p>}
      {runs === null && !error && <p className="text-sm text-neutral-500">Loading…</p>}
      {runs && runs.length === 0 && <p className="text-sm text-neutral-500">No runs yet.</p>}
      {runs && runs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400">
              <tr>
                <th className="py-1.5 pr-3 font-normal">Workflow</th>
                <th className="py-1.5 pr-3 font-normal">Status</th>
                <th className="py-1.5 pr-3 font-normal">Trigger</th>
                <th className="py-1.5 pr-3 font-normal">Started</th>
                <th className="py-1.5 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const b = badge(r.status, r.conclusion);
                return (
                  <tr key={r.id} className="border-t border-neutral-800">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${b.className}`}>
                        {b.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-neutral-400">{r.event}</td>
                    <td className="py-2 pr-3 text-neutral-400">{relativeTime(r.createdAt)}</td>
                    <td className="py-2">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline"
                      >
                        logs ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
