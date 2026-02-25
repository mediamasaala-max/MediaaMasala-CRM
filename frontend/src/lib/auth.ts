import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const JWT_EXPIRY_HOURS = 48;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: JWT_EXPIRY_HOURS * 60 * 60, // 48 hours — matches backend JWT expiry
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
          const loginUrl = apiBase.endsWith('/api') ? `${apiBase}/auth/login` : `${apiBase}/api/auth/login`

          const res = await fetch(loginUrl, {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" }
          })

          // Safety check: NextAuth authorize must return an object or null
          if (!res.ok) {
            const errorText = await res.text();
            console.error("Login failed:", res.status, errorText);
            return null;
          }

          const data = await res.json()

          if (data.user) {
            return {
              ...data.user,
              id: data.user.id,
              token: data.token,
              permissions: data.permissions
            }
          }
          return null
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any, user: any }) {
      if (user) {
        token.role = user.role;
        token.department = user.department;
        token.accessToken = user.token;
        token.employeeId = user.employee?.id;
        // Record when backend JWT expires
        token.tokenExpiry = Date.now() + JWT_EXPIRY_HOURS * 60 * 60 * 1000;
        delete token.error; // Clear any previous errors on fresh login
      }

      // If the backend token has expired, flag it so the client can sign out
      if (token.tokenExpiry && Date.now() > token.tokenExpiry) {
        return { ...token, error: "TokenExpired" };
      }

      return token;
    },
    async session({ session, token }: { session: any, token: any }) {
      if (token && session.user) {
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.accessToken = token.accessToken;
        session.user.employeeId = token.employeeId;
      }
      // Expose error to client so SessionGuard can react
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
};
