import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "bkrea.com").toLowerCase().trim();

interface ErrorContent {
  title: string;
  body: string;
}

function errorContent(error: string | undefined, rejected: string | undefined): ErrorContent | null {
  if (!error) return null;
  if (error === "domain") {
    if (rejected && rejected !== "no-email-returned") {
      return {
        title: "Wrong account",
        body: `You signed in as ${rejected}. This site is only for @${ALLOWED_DOMAIN} accounts — try a different Google account.`,
      };
    }
    return {
      title: "Wrong account",
      body: `This site is only for @${ALLOWED_DOMAIN} accounts. Sign in with a different Google account.`,
    };
  }
  // Any other NextAuth error code (OAuthCallback, Configuration, etc).
  return {
    title: "Sign-in didn't go through",
    body: "Something went wrong on Google's side. Try again — if it keeps happening, refresh and use a different browser tab.",
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; rejected?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) redirect("/");

  const { error, rejected } = await searchParams;
  const errMsg = errorContent(error, rejected);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">YIMBY Tracker</h1>
          <p className="text-sm text-neutral-400 mt-2">
            NYC development pipeline, curated daily.
          </p>
        </div>

        <div className="border border-neutral-800 rounded-xl p-6 bg-neutral-900/40 shadow-lg">
          {errMsg ? (
            <div className="mb-4 p-3 border border-amber-500/30 bg-amber-500/5 rounded text-sm">
              <p className="text-amber-200 font-medium mb-0.5">{errMsg.title}</p>
              <p className="text-neutral-300">{errMsg.body}</p>
            </div>
          ) : null}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>

          <p className="text-xs text-neutral-500 mt-4 text-center">
            Use your @{ALLOWED_DOMAIN} account.
          </p>
        </div>
      </div>
    </main>
  );
}
