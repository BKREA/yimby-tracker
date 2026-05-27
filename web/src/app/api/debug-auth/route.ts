/**
 * Diagnostic endpoint. Reports the SHAPE of auth env vars without leaking values.
 * Useful only to confirm NextAuth setup before / during a Configuration error.
 * Will be removed once the bug is found.
 */
export async function GET() {
  const sid = process.env.AUTH_GOOGLE_ID ?? "";
  const ssec = process.env.AUTH_GOOGLE_SECRET ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? "";

  return Response.json({
    runtime: {
      vercel: !!process.env.VERCEL,
      vercelUrl: process.env.VERCEL_URL ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    },
    AUTH_SECRET: {
      present: secret.length > 0,
      length: secret.length,
      hasLeadingTrailingWhitespace: secret !== secret.trim(),
    },
    AUTH_GOOGLE_ID: {
      present: sid.length > 0,
      length: sid.length,
      looksValid: sid.endsWith(".apps.googleusercontent.com"),
      firstChars: sid ? sid.slice(0, 6) + "…" : null,
      hasLeadingTrailingWhitespace: sid !== sid.trim(),
    },
    AUTH_GOOGLE_SECRET: {
      present: ssec.length > 0,
      length: ssec.length,
      startsWithGOCSPX: ssec.startsWith("GOCSPX-"),
      hasLeadingTrailingWhitespace: ssec !== ssec.trim(),
    },
    ALLOWED_EMAIL_DOMAIN: {
      present: domain.length > 0,
      value: domain,  // not a secret
      hasLeadingTrailingWhitespace: domain !== domain.trim(),
    },
  });
}
