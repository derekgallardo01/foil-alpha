import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
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

  interface User extends DefaultUser {
    id: string;
    role: string;
    subscriptionStatus: string;
    isVerified: boolean;
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