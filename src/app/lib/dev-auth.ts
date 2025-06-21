// Development authentication helpers
// Make sure this file is created at: src/app/lib/dev-auth.ts

export interface DevUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  password: string;
}

export const DEV_USERS: DevUser[] = [
  {
    id: 999,
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin',
    password: 'admin12345' // 8+ characters
  },
  {
    id: 998,
    email: 'user1@test.com',
    name: 'Test User 1',
    role: 'user',
    password: 'user12345' // 8+ characters
  },
  {
    id: 997,
    email: 'user2@test.com',
    name: 'Test User 2',
    role: 'user',
    password: 'user12345' // 8+ characters
  },
  {
    id: 996,
    email: 'buyer@test.com',
    name: 'Buyer User',
    role: 'user',
    password: 'buyer12345' // 8+ characters
  },
  {
    id: 995,
    email: 'seller@test.com',
    name: 'Seller User',
    role: 'user',
    password: 'seller12345' // 8+ characters
  }
];

export function getDevUser(email: string): DevUser | null {
  return DEV_USERS.find(user => user.email === email) || null;
}

export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_AUTH === 'true';
}

// Return the current dev user for API calls
export function getCurrentDevUserForAPI(): DevUser | null {
  if (!isDevMode()) {
    return null;
  }

  // Use environment variable DEV_USER_EMAIL to select a user, default to admin
  const devUserEmail = process.env.DEV_USER_EMAIL || 'admin@test.com';
  return getDevUser(devUserEmail);
}

// Insert dev users into database if they don't exist
export async function seedDevUsers() {
  if (!isDevMode()) return;

  const { prisma } = await import('./prisma');
  const bcrypt = await import('bcryptjs');

  for (const devUser of DEV_USERS) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: devUser.email }
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(devUser.password, 10);

        await prisma.user.create({
          data: {
            id: devUser.id,
            email: devUser.email,
            name: devUser.name,
            password: hashedPassword,
            role: devUser.role,
            is_verified: true, // Changed to boolean as per Prisma schema
            subscriptionStatus: 'active'
          }
        });

        // Create wallet for user
        await prisma.userWallet.create({
          data: {
            user_id: devUser.id,
            balance: devUser.role === 'admin' ? 10000.00 : 1000.00
          }
        });

        console.log(`✅ Created dev user: ${devUser.email}`);
      }
    } catch (error) {
      console.log(`⚠️ Dev user ${devUser.email} already exists or error:`, error);
    }
  }
}