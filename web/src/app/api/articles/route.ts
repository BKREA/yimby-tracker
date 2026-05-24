import { NextResponse } from "next/server";
import { loadArticles } from "@/lib/articles";

export async function GET() {
  try {
    const all = await loadArticles();
    const sorted = [...all].sort((a, b) =>
      (a.scraped_at ?? "") < (b.scraped_at ?? "") ? 1 : -1,
    );
    // Strip the long body field — everything else (~1 KB / record) goes to client
    // so tab counts and filtering reflect the full dataset, not just the first page.
    const articles = sorted.map(({ body, ...rest }) => rest);
    return NextResponse.json({ articles, total: all.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
