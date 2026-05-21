function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export interface Article {
  url: string;
  address: string;
  developer: string;
  neighborhood: string;
  borough: string;
  notes: string;
  body: string;
  scraped_at: string;
}

export async function loadArticles(): Promise<Article[]> {
  // Public raw URL — no auth needed once the repo is public.
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/main/articles.json`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`fetch articles.json failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("articles.json is not an array");
  return data as Article[];
}
