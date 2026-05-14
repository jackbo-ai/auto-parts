import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config (no Prisma, no bcrypt). Used by middleware. The full
// config that adds the Credentials provider lives in src/auth.ts.
export const authConfig = {
  // 8 hours, slid forward on every authenticated request.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8, updateAge: 0 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
