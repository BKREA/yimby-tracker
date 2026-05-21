import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecentRuns } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const runs = await listRecentRuns(15);
    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        url: r.html_url,
        event: r.event,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        path: r.path,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
