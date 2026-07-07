import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireAdmin } from "../../../lib/auth";
import bcrypt from "bcryptjs";

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
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

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

    const userIds = [...new Set(users.map((u) => u.id))];

    // Batch-fetch wallets for all users
    const wallets = await prisma.userWallet.findMany({
      where: { user_id: { in: userIds } },
    });
    const walletMap = new Map(wallets.map((w) => [w.user_id, w] as const));

    // Create wallets for any users missing one (preserves original side effect)
    for (const user of users) {
      if (!walletMap.has(user.id)) {
        console.log(`Creating missing wallet for user ${user.id} (${user.email})`);
        const wallet = await prisma.userWallet.create({
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

        walletMap.set(user.id, wallet);
      }
    }

    // Batch-fetch user card + transaction statistics
    const cardCounts = await prisma.userCard.groupBy({
      by: ['owner_id'],
      where: { owner_id: { in: userIds } },
      _count: { _all: true },
    });
    const cardCountMap = new Map(cardCounts.map((c) => [c.owner_id, c._count._all] as const));

    const purchaseCounts = await prisma.cardTransactionHistory.groupBy({
      by: ['toUserId'],
      where: { toUserId: { in: userIds }, action: 'SALE' },
      _count: { _all: true },
    });
    const purchaseCountMap = new Map(purchaseCounts.map((c) => [c.toUserId, c._count._all] as const));

    const saleCounts = await prisma.cardTransactionHistory.groupBy({
      by: ['fromUserId'],
      where: { fromUserId: { in: userIds }, action: 'SALE' },
      _count: { _all: true },
    });
    const saleCountMap = new Map(saleCounts.map((c) => [c.fromUserId, c._count._all] as const));

    const usersWithWallets: UserResponse[] = users.map((user) => {
      const wallet = walletMap.get(user.id)!;
      return {
        ...user,
        balance: Number(wallet.balance),
        frozen_balance: Number(wallet.frozen_balance),
        available_balance: Number(wallet.balance) - Number(wallet.frozen_balance),
        cardCount: cardCountMap.get(user.id) || 0,
        purchaseCount: purchaseCountMap.get(user.id) || 0,
        saleCount: saleCountMap.get(user.id) || 0,
      };
    });

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
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;
    const user = auth.user;

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
            description: `Initial deposit by admin: ${user.name}`,
            reference_type: 'ADMIN_DEPOSIT',
            admin_id: user.id,
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