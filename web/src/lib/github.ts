const GH_API = "https://api.github.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function repoPath(): string {
  return `${env("GITHUB_OWNER")}/${env("GITHUB_REPO")}`;
}

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env("GH_TOKEN")}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export type DispatchInputs = Record<string, string | boolean>;

export async function dispatchWorkflow(workflowFile: string, inputs: DispatchInputs = {}): Promise<void> {
  const res = await ghFetch(`/repos/${repoPath()}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
  if (res.status !== 204) {
    const body = await res.text();
    throw new Error(`workflow_dispatch failed: ${res.status} ${body}`);
  }
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  event: string;
  workflow_id: number;
  path: string;
}

export async function listRecentRuns(perPage = 15): Promise<WorkflowRun[]> {
  const res = await ghFetch(`/repos/${repoPath()}/actions/runs?per_page=${perPage}`);
  if (!res.ok) throw new Error(`list runs failed: ${res.status}`);
  const data = (await res.json()) as { workflow_runs: WorkflowRun[] };
  return data.workflow_runs;
}
