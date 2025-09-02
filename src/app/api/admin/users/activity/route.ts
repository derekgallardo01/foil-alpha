import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";
import type { Session } from "next-auth";

// Interface for response user data
interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  registeredAt: Date;
  last_login_at: Date | null;
  subscriptionStatus: string;
  balance: number;
  frozen_balance: number;
  available_balance: number;
  cardCount: number;
  purchaseCount: number;
  saleCount: number;
}

// Interface for POST request body
interface CreateUserBody {
  name: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  password: string;
  initialBalance?: number | string;
}

// GET /api/admin/users - List all users with wallet information
export async function GET() {
  try {
    const session = (await getServerSession(authOptions)) as Session | null;

    console.log("Admin users API - Session check:", session ? 'Authenticated' : 'Not authenticated');

    if (!session || session.user.role !== "admin") {
      console.log("Unauthorized access attempt to admin users API");
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    console.log("Fetching users from database...");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        registeredAt: true,
        last_login_at: true,
        subscriptionStatus: true,
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    console.log(`Found ${users.length} users, fetching wallet information...`);

    const usersWithWallets: UserResponse[] = await Promise.all(
      users.map(async (user) => {
        try {
          // Get or create wallet for each user
          let wallet = await prisma.userWallet.findUnique({
            where: { user_id: user.id },
          });

          // Create wallet if it doesn't exist
          if (!wallet) {
            console.log(`Creating missing wallet for user ${user.id} (${user.email})`);
            wallet = await prisma.userWallet.create({
              data: {
                user_id: user.id,
                balance: 0,
                frozen_balance: 0
              }
            });

            // Create setup transaction
            await prisma.walletTransaction.create({
              data: {
                user_id: user.id,
                wallet_id: wallet.id,
                transaction_type: 'WALLET_SETUP',
                amount: 0,
                balance_before: 0,
                balance_after: 0,
                description: 'Wallet created automatically by admin panel',
                reference_type: 'SYSTEM_SETUP'
              }
            });
          }

          // Get user card statistics
          const userCards = await prisma.userCard.count({
            where: { owner_id: user.id },
          });

          const purchases = await prisma.cardTransactionHistory.count({
            where: { toUserId: user.id, action: 'SALE' },
          });

          const sales = await prisma.cardTransactionHistory.count({
            where: { fromUserId: user.id, action: 'SALE' },
          });

          return {
            ...user,
            balance: Number(wallet.balance),
            frozen_balance: Number(wallet.frozen_balance),
            available_balance: Number(wallet.balance) - Number(wallet.frozen_balance),
            cardCount: userCards,
            purchaseCount: purchases,
            saleCount: sales,
          };
        } catch (walletError) {
          console.error(`Error processing wallet for user ${user.id}:`, walletError);
          return {
            ...user,
            balance: 0,
            frozen_balance: 0,
            available_balance: 0,
            cardCount: 0,
            purchaseCount: 0,
            saleCount: 0,
          };
        }
      }),
    );

    console.log("Successfully returning users with wallet data");
    return NextResponse.json(usersWithWallets);

  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);
    return NextResponse.json({
      message: "Error fetching users",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

// POST /api/admin/users - Create new user with wallet
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json()) as CreateUserBody;
    const { name, email, role, subscriptionStatus, password, initialBalance = 0 } = body;

    console.log("Creating new user:", { name, email, role, initialBalance });

    // Validate required fields
    if (!name || !email || !role || !subscriptionStatus || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Validate initialBalance
    const initialBalanceNum = parseFloat(String(initialBalance));
    if (isNaN(initialBalanceNum) || initialBalanceNum < 0) {
      return NextResponse.json({
        message: "Invalid initialBalance: must be a non-negative number"
      }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "Email already exists" }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with wallet in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          role,
          subscriptionStatus,
          password: hashedPassword,
          is_verified: 0,
        },
      });

      // Create wallet
      const wallet = await tx.userWallet.create({
        data: {
          user_id: newUser.id,
          balance: initialBalanceNum,
          frozen_balance: 0,
        },
      });

      // Create wallet transaction
      if (initialBalanceNum > 0) {
        await tx.walletTransaction.create({
          data: {
            user_id: newUser.id,
            wallet_id: wallet.id,
            transaction_type: 'INITIAL_DEPOSIT',
            amount: initialBalanceNum,
            balance_before: 0,
            balance_after: initialBalanceNum,
            description: `Initial deposit by admin: ${session.user.name}`,
            reference_type: 'ADMIN_DEPOSIT',
            admin_id: parseInt(String(session.user.id)),
          },
        });
      } else {
        await tx.walletTransaction.create({
          data: {
            user_id: newUser.id,
            wallet_id: wallet.id,
            transaction_type: 'WALLET_SETUP',
            amount: 0,
            balance_before: 0,
            balance_after: 0,
            description: 'Wallet created during user registration',
            reference_type: 'SYSTEM_SETUP',
          },
        });
      }

      return { user: newUser, wallet };
    });

    console.log(`Successfully created user ${result.user.id} with wallet`);

    return NextResponse.json({
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      registeredAt: result.user.registeredAt,
      lastLoginAt: result.user.last_login_at,
      subscriptionStatus: result.user.subscriptionStatus,
      balance: Number(result.wallet.balance),
      frozen_balance: Number(result.wallet.frozen_balance),
      available_balance: Number(result.wallet.balance),
      cardCount: 0,
      purchaseCount: 0,
      saleCount: 0,
    }, { status: 201 });

  } catch (error) {
    console.error("Error adding user:", error);
    return NextResponse.json({
      message: `Error adding user: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }, { status: 500 });
  }
}

// PUT /api/admin/users/[id] - Update user (handled by individual user route)
// DELETE /api/admin/users/[id] - Delete user (handled by individual user route)