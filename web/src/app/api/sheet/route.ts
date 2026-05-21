import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recentRows, rowCount } from "@/lib/sheets";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [rows, total] = await Promise.all([recentRows(25), rowCount()]);
    return NextResponse.json({ rows, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
