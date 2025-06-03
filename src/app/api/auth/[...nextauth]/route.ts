import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { getDbConnection } from '../../../lib/db';
import { sendEmail } from '../../../lib/email';

// Define interface for user data from the database
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
  subscriptionStatus: string;
  is_verified: boolean;
  discord_access_token?: string | null;
  discord_refresh_token?: string | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_scopes?: string | null;
  verification_code?: string | null;
  last_login_at?: Date | null;
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { email, password } = credentials || {};
        if (!email || !password) return null;

        const pool = await getDbConnection();
        try {
          const [rows]: [User[], unknown] = await pool.execute(
            'SELECT id, name, email, password, role, subscriptionStatus, is_verified FROM users WHERE email = ?',
            [email]
          );
          if (rows.length === 0) return null;

          const user = rows[0];
          if (!user.is_verified) throw new Error('Please verify your email first.');

          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (isPasswordValid) {
            await pool.execute(
              'UPDATE users SET last_login_at = NOW() WHERE email = ?',
              [email]
            );
            return {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
              role: user.role,
              subscriptionStatus: user.subscriptionStatus,
              isVerified: user.is_verified,
            };
          }
          return null;
        } catch (error) {
          console.error('Authorize error:', error);
          throw error;
        } finally {
          await pool.end();
        }
      },
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify email', access_type: 'offline' } },
      token: 'https://discord.com/api/oauth2/token',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: 'profile email', access_type: 'offline', prompt: 'consent' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('SignIn callback - Provider:', account?.provider, 'User:', user, 'Profile:', profile, 'Account:', account);
      const pool = await getDbConnection();
      try {
        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        if (account?.provider === 'discord') {
          const [rows]: [User[], unknown] = await pool.execute(
            'SELECT id, name, email, role, subscriptionStatus, discord_access_token, is_verified FROM users WHERE email = ?',
            [user.email]
          );
          if (rows.length === 0) {
            const [result] = await pool.execute(
              'INSERT INTO users (email, name, password, role, subscriptionStatus, discord_access_token, discord_refresh_token, last_login_at, is_verified, verification_code) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)',
              [
                user.email,
                profile?.username || user.name || 'Discord User',
                'discord-user',
                'user',
                'inactive',
                account.access_token || null,
                account.refresh_token || null,
                0,
                verificationCode,
              ]
            );
            user.id = result.insertId.toString();
            console.log('Registered new Discord user:', user.email);

            const htmlContent = `
              <h2>Email Verification</h2>
              <p>Welcome to TCG Market! Please verify your email address.</p>
              <p>Your verification code is: <strong>${verificationCode}</strong></p>
              <p>Enter this code on the verification page to activate your account.</p>
            `;
            await sendEmail(user.email!, 'Verify Your TCG Market Account', htmlContent);
          } else {
            const dbUser = rows[0];
            user.id = dbUser.id.toString();
            user.name = dbUser.name;
            user.role = dbUser.role;
            user.subscriptionStatus = dbUser.subscriptionStatus;
            user.isVerified = dbUser.is_verified;

            if (!dbUser.is_verified) {
              if (!dbUser.verification_code) {
                await pool.execute(
                  'UPDATE users SET verification_code = ? WHERE email = ?',
                  [verificationCode, user.email]
                );
                const htmlContent = `
                  <h2>Email Verification</h2>
                  <p>Please verify your email address to activate your TCG Market account.</p>
                  <p>Your verification code is: <strong>${verificationCode}</strong></p>
                  <p>Enter this code on the verification page.</p>
                `;
                await sendEmail(user.email!, 'Verify Your TCG Market Account', htmlContent);
              }
              return `/verify-email?email=${encodeURIComponent(user.email!)}`;
            }

            await pool.execute(
              'UPDATE users SET discord_access_token = ?, discord_refresh_token = ?, last_login_at = NOW() WHERE email = ?',
              [
                account.access_token || dbUser.discord_access_token,
                account.refresh_token || dbUser.discord_refresh_token,
                user.email,
              ]
            );
            console.log('Updated Discord tokens and last login for:', user.email);
          }
          if (!account.refresh_token) console.warn('No refresh_token received from Discord for:', user.email);
        } else if (account?.provider === 'google') {
          const grantedScopes = account.scope ? account.scope.split(' ') : [];
          console.log('Granted scopes for Google:', grantedScopes);

          const [rows]: [User[], unknown] = await pool.execute(
            'SELECT id, name, email, role, subscriptionStatus, google_access_token, is_verified FROM users WHERE email = ?',
            [user.email]
          );
          if (rows.length === 0) {
            const [result] = await pool.execute(
              'INSERT INTO users (email, name, password, role, subscriptionStatus, google_access_token, google_refresh_token, google_scopes, last_login_at, is_verified, verification_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)',
              [
                user.email || profile?.email,
                user.name || profile?.name || 'Google User',
                'google-user',
                'user',
                'inactive',
                account.access_token || null,
                account.refresh_token || null,
                grantedScopes.join(' '),
                0,
                verificationCode,
              ]
            );
            user.id = result.insertId.toString();
            console.log('Registered new Google user:', user.email);

            const htmlContent = `
              <h2>Email Verification</h2>
              <p>Welcome to TCG Market! Please verify your email address.</p>
              <p>Your verification code is: <strong>${verificationCode}</strong></p>
              <p>Enter this code on the verification page to activate your account.</p>
            `;
            await sendEmail(user.email!, 'Verify Your TCG Market Account', htmlContent);
          } else {
            const dbUser = rows[0];
            user.id = dbUser.id.toString();
            user.name = dbUser.name || (grantedScopes.includes('profile') ? profile?.name : 'Google User');
            user.role = dbUser.role;
            user.subscriptionStatus = dbUser.subscriptionStatus;
            user.isVerified = dbUser.is_verified;

            if (!dbUser.is_verified) {
              if (!dbUser.verification_code) {
                await pool.execute(
                  'UPDATE users SET verification_code = ? WHERE email = ?',
                  [verificationCode, user.email]
                );
                const htmlContent = `
                  <h2>Email Verification</h2>
                  <p>Please verify your email address to activate your TCG Market account.</p>
                  <p>Your verification code is: <strong>${verificationCode}</strong></p>
                  <p>Enter this code on the verification page.</p>
                `;
                await sendEmail(user.email!, 'Verify Your TCG Market Account', htmlContent);
              }
              return `/verify-email?email=${encodeURIComponent(user.email!)}`;
            }

            await pool.execute(
              'UPDATE users SET google_access_token = ?, google_refresh_token = ?, google_scopes = ?, last_login_at = NOW() WHERE email = ?',
              [account.access_token, account.refresh_token, grantedScopes.join(' '), user.email]
            );
            console.log('Updated Google tokens, scopes, and last login for:', user.email);
          }
          if (!account.refresh_token) console.warn('No refresh_token received from Google for:', user.email);
        }

        const [userRows]: [User[], unknown] = await pool.execute(
          'SELECT is_verified FROM users WHERE email = ?',
          [user.email]
        );
        if (userRows.length > 0 && !userRows[0].is_verified) {
          return `/verify-email?email=${encodeURIComponent(user.email!)}`;
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      } finally {
        await pool.end();
      }
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.subscriptionStatus = user.subscriptionStatus;
        token.isVerified = user.isVerified;

        if (account.provider === 'discord') {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : null;
        } else if (account.provider === 'google') {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
          token.googleScopes = account.scope;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = session.user || {};
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.subscriptionStatus = token.subscriptionStatus;
        session.user.isVerified = token.isVerified;
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.accessTokenExpires = token.accessTokenExpires;
        session.googleScopes = token.googleScopes;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);