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
      authorization: { params: { scope: "identify email", access_type: "offline" } },
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
      console.log("SignIn callback - Provider:", account.provider, "User:", user, "Profile:", profile, "Account:", account);
      if (account.provider === "discord") {
        const connection = await getDbConnection();
        try {
          // Query existing columns only for SELECT
          const [rows] = await connection.execute(
            "SELECT id, name, email, role, subscriptionStatus, discord_access_token FROM users WHERE email = ?",
            [user.email]
          );
          if (rows.length === 0) {
            // New Discord user, register with tokens
            const [result] = await connection.execute(
              "INSERT INTO users (email, name, password, role, subscriptionStatus, discord_access_token, discord_refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                user.email,
                profile.username || user.name,
                "discord-user",
                "user",
                "inactive",
                account.access_token || null,
                account.refresh_token || null,
              ]
            );
            user.id = result.insertId.toString();
            console.log("Registered new Discord user with tokens:", user.email);
          } else {
            // Existing user, update tokens
            const dbUser = rows[0];
            user.id = dbUser.id.toString();
            user.name = dbUser.name;
            user.role = dbUser.role;
            user.subscription_status = dbUser.subscriptionStatus;

            // Update tokens, handling new column safely
            try {
              await connection.execute(
                "UPDATE users SET discord_access_token = ?, discord_refresh_token = ? WHERE email = ?",
                [
                  account.access_token || dbUser.discord_access_token,
                  account.refresh_token || dbUser.discord_refresh_token,
                  user.email,
                ]
              );
              console.log("Updated Discord tokens for:", user.email);
            } catch (updateError) {
              if (updateError.code === 'ER_BAD_FIELD_ERROR' && updateError.sqlMessage.includes('discord_refresh_token')) {
                console.warn("discord_refresh_token column missing; skipping update. Run ALTER TABLE users ADD COLUMN discord_refresh_token VARCHAR(255);");
                await connection.execute(
                  "UPDATE users SET discord_access_token = ? WHERE email = ?",
                  [
                    account.access_token || dbUser.discord_access_token,
                    user.email,
                  ]
                );
              } else {
                throw updateError;
              }
            }
          }

          if (!account.refresh_token) {
            console.warn("No refresh_token received from Discord for:", user.email);
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
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.subscription_status = user.subscription_status;
        if (account.provider === "discord") {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : null;
        }
      }
      if (token.accessTokenExpires && Date.now() > token.accessTokenExpires) {
        console.log("Discord token expired, attempting refresh for:", token.email);
        if (token.refreshToken) {
          try {
            const response = await fetch("https://discord.com/api/oauth2/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
              }).toString(),
            });
            const refreshedTokens = await response.json();
            if (response.ok) {
              token.accessToken = refreshedTokens.access_token;
              token.refreshToken = refreshedTokens.refresh_token || token.refreshToken;
              token.accessTokenExpires = Date.now() + (refreshedTokens.expires_in || 3600) * 1000;

              const connection = await getDbConnection();
              try {
                await connection.execute(
                  "UPDATE users SET discord_access_token = ?, discord_refresh_token = ? WHERE email = ?",
                  [token.accessToken, token.refreshToken, token.email]
                );
                console.log("Refreshed Discord tokens for:", token.email);
              } catch (error) {
                console.error("Error updating refreshed tokens:", error);
                if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage.includes('discord_refresh_token')) {
                  console.warn("discord_refresh_token column missing; skipping refresh token update.");
                  await connection.execute(
                    "UPDATE users SET discord_access_token = ? WHERE email = ?",
                    [token.accessToken, token.email]
                  );
                }
              } finally {
                connection.end();
              }
            } else {
              console.error("Failed to refresh Discord token:", refreshedTokens.error);
            }
          } catch (error) {
            console.error("Token refresh error:", error);
          }
        } else {
          console.warn("No refresh_token available for token refresh:", token.email);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = session.user || {}; // Ensure user object exists
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.subscription_status = token.subscription_status;
        // Persist tokens in the session for client-side access
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.accessTokenExpires = token.accessTokenExpires;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };