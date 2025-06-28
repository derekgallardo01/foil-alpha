// src/app/lib/auth-helper.ts
import { decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

export async function getServerSession(): Promise<Session | null> {
    try {
        const cookieStore = await cookies();

        // Get the session token from cookies
        const sessionToken = cookieStore.get('next-auth.session-token')?.value ||
            cookieStore.get('__Secure-next-auth.session-token')?.value;

        if (!sessionToken) {
            return null;
        }

        // Decode the JWT token
        const decoded = await decode({
            token: sessionToken,
            secret: NEXTAUTH_SECRET,
        }) as JWT | null;

        if (!decoded) {
            return null;
        }

        // Calculate expiration date
        const expiresAt = decoded.exp
            ? new Date((decoded.exp as number) * 1000).toISOString()
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default to 24 hours

        // Return session in the expected format
        return {
            user: {
                id: String(decoded.id || ''),
                email: String(decoded.email || ''),
                name: String(decoded.name || ''),
                role: String(decoded.role || 'user'),
                subscriptionStatus: String(decoded.subscriptionStatus || 'inactive'),
                isVerified: Boolean(decoded.isVerified),
            },
            expires: expiresAt,
            accessToken: decoded.accessToken as string | undefined,
            refreshToken: decoded.refreshToken as string | undefined,
            accessTokenExpires: decoded.accessTokenExpires as number | undefined,
            googleScopes: decoded.googleScopes as string | undefined,
        } as Session;
    } catch (error) {
        console.error('Error getting session:', error);
        return null;
    }
}