import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import { getDbConnection } from "../../../lib/db";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials;
        if (!email || !password) return null;

        const connection = await getDbConnection();
        try {
          const [rows] = await connection.execute(
            "SELECT id, name, email, password, role, subscriptionStatus FROM users WHERE email = ?",
            [email]
          );
          if (rows.length === 0) return null;

          const user = rows[0];
          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (isPasswordValid) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              subscription_status: user.subscriptionStatus,
            };
          }
          return null;
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        } finally {
          connection.end();
        }
      },
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify email" } },
      // Enable token refresh (optional, requires Discord app setup)
      token: "https://discord.com/api/oauth2/token",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    jwt: true,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("SignIn callback - Provider:", account.provider, "User:", user, "Profile:", profile);
      if (account.provider === "discord") {
        const connection = await getDbConnection();
        try {
          const [rows] = await connection.execute(
            "SELECT id, name, email, role, subscriptionStatus FROM users WHERE email = ?",
            [user.email]
          );
          if (rows.length === 0) {
            const [result] = await connection.execute(
              "INSERT INTO users (email, name, password, role, subscriptionStatus) VALUES (?, ?, ?, ?, ?)",
              [user.email, profile.username || user.name, "discord-user", "user", "inactive"]
            );
            user.id = result.insertId.toString();
            console.log("Registered new Discord user:", user.email);
          } else {
            const dbUser = rows[0];
            user.id = dbUser.id.toString();
            user.name = dbUser.name;
            user.role = dbUser.role;
            user.subscription_status = dbUser.subscriptionStatus;
          }
        } catch (error) {
          console.error("Error syncing Discord user:", error);
          return false;
        } finally {
          connection.end();
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        // Initial sign-in
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.subscription_status = user.subscription_status;
        if (account.provider === "discord") {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token; // Store refresh token if available
          token.accessTokenExpires = account.expires_at;
        }
      }
      // Refresh token logic (if Discord provides one)
      if (token.accessTokenExpires && Date.now() > token.accessTokenExpires * 1000) {
        console.log("Discord token expired, refreshing...");
        // Add refresh logic here if needed (Discord doesn’t always provide refresh tokens)
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.subscription_status = token.subscription_status;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };