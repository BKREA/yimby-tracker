import { NextRequest, NextResponse } from "next/server";

// Gates every route — including API routes — behind a single password
// (HTTP Basic auth). Browser shows a native prompt and remembers the
// credentials for the session. If APP_PASSWORD is unset (e.g. local dev
// without the env var), the middleware is a no-op.

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const colon = decoded.indexOf(":");
    const pw = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    if (pw === password) return NextResponse.next();
  }

  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="YIMBY Tracker"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
