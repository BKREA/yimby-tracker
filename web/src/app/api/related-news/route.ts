import { NextResponse } from "next/server";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

interface RelatedRecord {
  address: string;
  title: string;
  url: string;
  source: string;
  published: string;
  snippet: string;
  fetched_at: string;
}

interface RelatedFile {
  articles: RelatedRecord[];
  address_refresh_dates: Record<string, string>;
}

export async function GET() {
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/related_news.json`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) {
      // File hasn't been committed yet — return empty so the UI degrades gracefully.
      return NextResponse.json({ byAddress: {}, totalCount: 0 });
    }
    const data = (await res.json()) as RelatedFile;

    // Group by address for easy lookup from the article rows.
    const byAddress: Record<string, RelatedRecord[]> = {};
    for (const rec of data.articles ?? []) {
      const key = rec.address;
      if (!key) continue;
      if (!byAddress[key]) byAddress[key] = [];
      byAddress[key].push(rec);
    }
    // Sort each address's records: newest first.
    for (const key of Object.keys(byAddress)) {
      byAddress[key].sort((a, b) => (a.published < b.published ? 1 : -1));
    }
    return NextResponse.json({
      byAddress,
      totalCount: data.articles?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ byAddress: {}, totalCount: 0 });
  }
}
