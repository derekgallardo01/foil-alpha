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
  is_verified: boolean; // Keep as boolean for the response
}

export async function POST(req: Request) {
  console.log("Login request received");

  try {
    const { email, password }: LoginRequest = await req.json();
    console.log("Email received:", email);

    // Validate input
    if (!email || !password) {
      console.log("Missing email or password");
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format:", email);
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    console.log("Fetching user from DB by email:", email);

    // Fetch user from database using Prisma
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        is_verified: true,
      },
    });

    console.log("User found in DB:", user ? "Yes" : "No");

    // Check if user exists
    if (!user) {
      console.log("User not found for email:", email);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    // Check if password exists
    if (!user.password) {
      console.log("User has no password set:", email);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    console.log("Comparing passwords...");

    // Compare the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Invalid password for email:", email);
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    // Development bypass: Skip email verification check
    if (!DEV_BYPASS.SKIP_EMAIL_VERIFICATION && !user.is_verified) {
      console.log("User email not verified:", email);
      return NextResponse.json(
        {
          message: "Please verify your email address before logging in.",
          requiresVerification: true,
        },
        { status: 403 }
      );
    } else if (DEV_BYPASS.SKIP_EMAIL_VERIFICATION && !user.is_verified) {
      console.log("🚀 DEV MODE: Bypassing email verification check for:", email);
    } else {
      console.log("User email verified, proceeding with login");
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    console.log("Login successful for email:", email);

    // Prepare safe user response (handle is_verified null case)
    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_verified: !!user.is_verified, // Convert number|null to boolean
    };

    // Enhanced response with dev mode info
    return NextResponse.json(
      {
        message: "Login successful",
        user: userResponse,
        ...(DEV_BYPASS.SKIP_EMAIL_VERIFICATION &&
          !user.is_verified && {
            devMode: true,
            bypassedVerification: true,
          }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("An error occurred during the login process:", error);
    return NextResponse.json(
      {
        message: "An error occurred while logging in.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}