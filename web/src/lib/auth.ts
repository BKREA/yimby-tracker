import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      if (allowed.length === 0) return false;
      const email = user.email?.toLowerCase();
      return !!email && allowed.includes(email);
    },
    session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
