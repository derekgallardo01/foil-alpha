// src/app/lib/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/app/lib/email";

// Extend default types
declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    subscriptionStatus: string;
    isVerified: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      subscriptionStatus: string;
      isVerified: boolean;
    };
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    googleScopes?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    subscriptionStatus: string;
    isVerified: boolean;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    googleScopes?: string;
  }
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "profile email", access_type: "offline", prompt: "consent" } },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            subscriptionStatus: true,
            isVerified: true,
          },
        });

        if (!user || !user.isVerified) {
          throw new Error("Please verify your email first.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password!);
        if (!isPasswordValid) return null;

        await prisma.user.update({
          where: { email: credentials.email },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          isVerified: user.isVerified,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord" || account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email || profile.email! },
        });

        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        if (!existingUser) {
          const newUser = await prisma.user.create({
            data: {
              email: user.email || profile.email!,
              name: user.name || profile.name || `${account.provider} User`,
              role: "user",
              subscriptionStatus: "inactive",
              isVerified: false,
              verificationCode,
              ...(account.provider === "discord" && {
                discordAccessToken: account.access_token,
                discordRefreshToken: account.refresh_token,
              }),
              ...(account.provider === "google" && {
                googleAccessToken: account.access_token,
                googleRefreshToken: account.refresh_token,
                googleScopes: account.scope,
              }),
            },
          });
          user.id = newUser.id.toString();

          const htmlContent = `
            <h2>Email Verification</h2>
            <p>Welcome to TCG Market! Please verify your email address.</p>
            <p>Your verification code is: <strong>${verificationCode}</strong></p>
            <p>Enter this code on the verification page to activate your account.</p>
          `;
          await sendEmail(user.email!, "Verify Your TCG Market Account", htmlContent);
        } else {
          user.id = existingUser.id.toString();
          user.name = existingUser.name;
          user.role = existingUser.role;
          user.subscriptionStatus = existingUser.subscriptionStatus;
          user.isVerified = existingUser.isVerified;

          if (!existingUser.isVerified) {
            if (!existingUser.verificationCode) {
              await prisma.user.update({
                where: { email: user.email! },
                data: { verificationCode },
              });
              const htmlContent = `
                <h2>Email Verification</h2>
                <p>Please verify your email address to activate your TCG Market account.</p>
                <p>Your verification code is: <strong>${verificationCode}</strong></p>
                <p>Enter this code on the verification page.</p>
              `;
              await sendEmail(user.email!, "Verify Your TCG Market Account", htmlContent);
            }
            return `/verify-email?email=${encodeURIComponent(user.email!)}`;
          }

          await prisma.user.update({
            where: { email: user.email! },
            data: {
              ...(account.provider === "discord" && {
                discordAccessToken: account.access_token,
                discordRefreshToken: account.refresh_token,
              }),
              ...(account.provider === "google" && {
                googleAccessToken: account.access_token,
                googleRefreshToken: account.refresh_token,
                googleScopes: account.scope,
              }),
              lastLoginAt: new Date(),
            },
          });
        }

        if (!user.isVerified) {
          return `/verify-email?email=${encodeURIComponent(user.email!)}`;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id;
        token.role = user.role;
        token.subscriptionStatus = user.subscriptionStatus;
        token.isVerified = user.isVerified;
        if (account.provider === "discord" || account.provider === "google") {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
          if (account.provider === "google") {
            token.googleScopes = account.scope;
          }
        }
      }

      // Refresh token if expired
      if (
        token.accessTokenExpires &&
        Date.now() > token.accessTokenExpires &&
        token.refreshToken &&
        token.provider
      ) {
        try {
          const response = await fetch(
            token.provider === "google"
              ? "https://oauth2.googleapis.com/token"
              : "https://discord.com/api/oauth2/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id:
                  token.provider === "google" ? process.env.GOOGLE_CLIENT_ID! : process.env.DISCORD_CLIENT_ID!,
                client_secret:
                  token.provider === "google"
                    ? process.env.GOOGLE_CLIENT_SECRET!
                    : process.env.DISCORD_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
              }),
            }
          );

          const refreshedTokens = await response.json();
          if (!response.ok) throw refreshedTokens;

          token.accessToken = refreshedTokens.access_token;
          token.refreshToken = refreshedTokens.refresh_token || token.refreshToken;
          token.accessTokenExpires = Date.now() + refreshedTokens.expires_in * 1000;

          await prisma.user.update({
            where: { id: token.id },
            data: {
              [token.provider === "google" ? "googleAccessToken" : "discordAccessToken"]:
                refreshedTokens.access_token,
              [token.provider === "google" ? "googleRefreshToken" : "discordRefreshToken"]:
                refreshedTokens.refresh_token || token.refreshToken,
            },
          });
        } catch (error) {
          console.error("Error refreshing token:", error);
          token.error = "RefreshAccessTokenError";
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          name: token.name,
          email: token.email,
          role: token.role,
          subscriptionStatus: token.subscriptionStatus,
          isVerified: token.isVerified,
        };
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.accessTokenExpires = token.accessTokenExpires;
        session.googleScopes = token.googleScopes;
        if (token.error) {
          session.error = token.error;
        }
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);