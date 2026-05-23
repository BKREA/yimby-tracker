import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/github";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const runId = body?.runId;
  if (typeof runId !== "number" || !Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Missing or invalid runId" }, { status: 400 });
  }
  try {
    await cancelRun(runId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
