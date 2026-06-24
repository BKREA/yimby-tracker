function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export interface Article {
  url: string;
  scraped_at: string;
  published?: string; // ISO publish datetime (YIMBY pubDate), distinct from scrape time
  title?: string;
  body?: string;

  article_type?: string;
  address?: string;
  street_address?: string;
  neighborhood?: string;
  borough?: string;
  notes?: string;

  // Development fields
  type?: string;
  developer?: string;
  architect?: string;
  number_of_units?: number | null;
  square_footage?: number | null;
  stories?: number | null;
  height_ft?: number | null;

  // Transaction fields
  transaction_amount?: number | null;
  price_per_unit?: number | null;
  price_per_square_foot?: number | null;
  buyer?: string;
  seller?: string;
  brokers?: string;
  date_of_transaction?: string;
}

// Last successfully-parsed corpus, kept on the (warm) server instance. If a
// later refetch hits a transient GitHub raw failure, we serve this rather than
// 500-ing the client. Stale-but-up beats a hard error for a ~daily-changing file.
let lastGood: Article[] | null = null;

export async function loadArticles(): Promise<Article[]> {
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/articles.json`;
  // Cache 60s. The file only changes after a workflow commit, so hammering
  // raw.githubusercontent.com on every load risks an anonymous-rate-limit 429/5xx.
  // Retry transient failures a couple of times before giving up.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (!res.ok) {
        throw new Error(`fetch articles.json failed: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as unknown;
      if (!Array.isArray(data)) throw new Error("articles.json is not an array");
      lastGood = data as Article[];
      return lastGood;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  // All attempts failed — serve the last good copy if we have one, else surface.
  if (lastGood) return lastGood;
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
