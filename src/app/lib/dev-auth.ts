import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

// Development authentication helpers
export interface DevUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  password: string;
}

// Updated to match your actual database users
export const DEV_USERS: DevUser[] = [
  {
    id: 1,
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin',
    password: 'admin123',
  },
  {
    id: 2,
    email: 'bob@test.com',
    name: 'Bob Smith',
    role: 'user',
    password: 'user123',
  },
  {
    id: 3,
    email: 'john@test.com',
    name: 'John Doe',
    role: 'user',
    password: 'user123',
  },
  {
    id: 4,
    email: 'charley@test.com',
    name: 'Charley Brown',
    role: 'user',
    password: 'user123',
  },
];

export function getDevUser(email: string): DevUser | null {
  return DEV_USERS.find((user) => user.email === email) || null;
}

export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_AUTH === 'true';
}

// FIXED: Return the current dev user based on who's actually logged in
export function getCurrentDevUserForAPI(): DevUser | null {
  if (!isDevMode()) {
    return null;
  }

  // Use John Doe by default (the user you're logged in as)
  const devUserEmail = process.env.DEV_USER_EMAIL || 'john@test.com';
  return getDevUser(devUserEmail);
}

// Simplified - just ensure wallets exist for existing users
export async function seedDevUsers() {
  if (!isDevMode()) return;

  for (const devUser of DEV_USERS) {
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: devUser.id },
      });

      if (existingUser) {
        // Check if wallet exists
        const existingWallet = await prisma.userWallet.findUnique({
          where: { user_id: devUser.id },
        });

        if (!existingWallet) {
          // Create wallet for existing user
          await prisma.userWallet.create({
            data: {
              user_id: devUser.id,
              balance: devUser.role === 'admin' ? 10000.00 : 1000.00,
              frozen_balance: 0.00,
            },
          });
          console.log(`✅ Created wallet for existing user: ${devUser.email}`);
        }
      }
    } catch (error) {
      console.error(`⚠️ Error setting up user ${devUser.email}:`, error);
    }
  }
}