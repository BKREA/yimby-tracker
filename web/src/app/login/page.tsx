import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email) redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm border border-neutral-800 rounded-lg p-8 bg-neutral-900/40">
        <h1 className="text-xl font-semibold mb-1">YIMBY Tracker</h1>
        <p className="text-sm text-neutral-400 mb-6">Sign in to continue.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full px-4 py-2 bg-white text-black rounded font-medium hover:bg-neutral-200"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
