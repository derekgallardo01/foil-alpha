
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      accessToken?: string;
    };
  }

  interface User {
    id: string;
    role: string;
    accessToken?: string;
    name?: string;
    email?: string;
    image?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    accessToken?: string;
    id: string;
  }
}
