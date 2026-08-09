import type { NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = ["/alertas", "/configuracoes", "/monitorar"];

export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        request.nextUrl.pathname.startsWith(prefix),
      );
      return !isProtected || !!auth?.user;
    },
  },
} satisfies NextAuthConfig