// // /var/www/my-next-app/src/app/api/auth/login/route.ts

// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { getDbConnection } from "../../../lib/db"; // Adjust the path to your db connection logic
// import type { RowDataPacket } from "mysql2/promise"; // Import RowDataPacket for typing

// interface User extends RowDataPacket {
//   id: number;
//   email: string;
//   name: string;
//   password: string;
// }

// export async function POST(req: Request) {
//   console.log("Login request received");

//   const { email, password } = await req.json();
//   console.log("Email received:", email);
//   console.log("Password received:", password);

//   if (!email || !password) {
//     console.log("Missing email or password");
//     return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
//   }

//   let connection;
//   try {
//     connection = await getDbConnection();
//   } catch (dbError) {
//     console.error("Database connection error:", dbError);
//     return NextResponse.json({ message: "Database connection error." }, { status: 500 });
//   }

//   try {
//     // Fetch user from the database by email with explicit typing
//     console.log("Fetching user from DB by email:", email);
//     const [rows] = await connection.execute<User[]>("SELECT * FROM users WHERE email = ?", [email]);
//     console.log("User fetched from DB:", rows);

//     // Check if user exists
//     if (rows.length === 0) {
//       console.log("User not found for email:", email);
//       return NextResponse.json({ message: "User not found" }, { status: 404 });
//     }

//     const user = rows[0];
//     console.log("User found in DB:", user);

//     // Compare the hashed password
//     console.log("Comparing passwords...");
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     console.log("Password validation result:", isPasswordValid);

//     if (!isPasswordValid) {
//       console.log("Invalid password for email:", email);
//       return NextResponse.json({ message: "Invalid password" }, { status: 403 });
//     }

//     console.log("Login successful for email:", email);
//     return NextResponse.json(
//       { message: "Login successful", user: { id: user.id, email: user.email, name: user.name } },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("An error occurred during the login process:", error);
//     return NextResponse.json({ message: "An error occurred while logging in." }, { status: 500 });
//   } finally {
//     if (connection) {
//       await connection.end();
//       console.log("Database connection closed");
//     }
//   }
// }


// Fixed Login Route with proper null handling for password
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { DEV_BYPASS } from "../../../lib/dev-bypass";

interface LoginRequest {
  email: string;
  password: string;
}

interface UserResponse {
  id: number;
  email: string;
  name: string;
  role: string;
  is_verified: boolean;
}

export async function POST(req: Request) {
  console.log("Login request received");

  try {
    const { email, password }: LoginRequest = await req.json();
    console.log("Email received:", email);

    // Validate input (keep your existing validation)
    if (!email || !password) {
      console.log("Missing email or password");
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    // Validate email format (keep existing logic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format:", email);
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    console.log("Fetching user from DB by email:", email);

    // Fetch user from database using Prisma (keep existing logic)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        is_verified: true
      }
    });

    console.log("User found in DB:", user ? "Yes" : "No");

    // Check if user exists (keep existing logic)
    if (!user) {
      console.log("User not found for email:", email);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    // Check if password exists (fix for TypeScript error)
    if (!user.password) {
      console.log("User has no password set:", email);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    console.log("Comparing passwords...");

    // Compare the hashed password (now with proper type safety)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Invalid password for email:", email);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    // Development bypass: Skip email verification check
    if (!DEV_BYPASS.SKIP_EMAIL_VERIFICATION && !user.is_verified) {
      // Production: Enforce email verification (your existing logic)
      console.log("User email not verified:", email);
      return NextResponse.json({
        message: "Please verify your email address before logging in.",
        requiresVerification: true
      }, { status: 403 });
    } else if (DEV_BYPASS.SKIP_EMAIL_VERIFICATION && !user.is_verified) {
      // Development: Allow login without verification but log it
      console.log("🚀 DEV MODE: Bypassing email verification check for:", email);
    } else {
      // User is verified - normal flow
      console.log("User email verified, proceeding with login");
    }

    // Update last login timestamp (keep existing logic)
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() }
    });

    console.log("Login successful for email:", email);

    // Prepare safe user response (without password) - keep existing logic
    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_verified: user.is_verified
    };

    // Enhanced response with dev mode info
    return NextResponse.json(
      {
        message: "Login successful",
        user: userResponse,
        ...(DEV_BYPASS.SKIP_EMAIL_VERIFICATION && !user.is_verified && {
          devMode: true,
          bypassedVerification: true
        })
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("An error occurred during the login process:", error);
    return NextResponse.json({
      message: "An error occurred while logging in.",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
