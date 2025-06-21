// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { getDbConnection } from "../../../lib/db";
// import { sendEmail } from "../../../lib/email";
// import { RowDataPacket } from "mysql2/promise"; // Import RowDataPacket for proper typing

// // Define the User type based on your database schema
// interface User {
//   id?: number;
//   email: string;
//   password: string;
//   name: string;
//   is_verified: number;
//   verification_code: string;
// }

// export async function POST(req: Request) {
//   const { email, password, name } = await req.json();

//   // Validate input
//   if (!email || !password || !name) {
//     return NextResponse.json({ message: "All fields are required." }, { status: 400 });
//   }

//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   if (!emailRegex.test(email)) {
//     return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
//   }
//   if (password.length < 8) {
//     return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
//   }
//   if (name.length < 2) {
//     return NextResponse.json({ message: "Name must be at least 2 characters." }, { status: 400 });
//   }

//   const connection = await getDbConnection();

//   try {
//     // Check for existing email
//     const [rows] = await connection.execute<(User & RowDataPacket)[]>("SELECT * FROM users WHERE email = ?", [email]);
//     if (rows.length > 0) {
//       return NextResponse.json({ message: "Email is already registered." }, { status: 400 });
//     }

//     // Generate verification code
//     const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
//     const hashedPassword = await bcrypt.hash(password, 12);

//     // Insert user with unverified status
//     await connection.execute(
//       "INSERT INTO users (email, password, name, is_verified, verification_code) VALUES (?, ?, ?, ?, ?)",
//       [email, hashedPassword, name, 0, verificationCode]
//     );

//     // Send verification email
//     const htmlContent = `
//       <h2>Email Verification</h2>
//       <p>Welcome to TCG Market! Please verify your email address.</p>
//       <p>Your verification code is: <strong>${verificationCode}</strong></p>
//       <p>Enter this code on the verification page to activate your account.</p>
//     `;
//     await sendEmail(email, "Verify Your TCG Market Account", htmlContent);

//     return NextResponse.json({ message: "User registered successfully. Please check your email to verify." }, { status: 201 });
//   } catch (error) {
//     console.error("Database or email error:", error);
//     return NextResponse.json({ message: "An error occurred while registering the user." }, { status: 500 });
//   } finally {
//     await connection.end();
//   }
// }

// Updated Registration Route with Dev Bypass
// Preserves all existing functionality while adding development shortcuts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { sendEmail } from "../../../lib/email";
import { DEV_BYPASS, mockSendEmail, getDevVerificationStatus } from "../../../lib/dev-bypass";

// Define the User type based on your Prisma schema
interface UserRegistrationData {
  email: string;
  password: string;
  name: string;
}

export async function POST(req: Request) {
  const { email, password, name }: UserRegistrationData = await req.json();

  // Validate input (keep your existing validation)
  if (!email || !password || !name) {
    return NextResponse.json({ message: "All fields are required." }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ message: "Name must be at least 2 characters." }, { status: 400 });
  }

  try {
    // Check for existing email using Prisma (keep existing logic)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 400 });
    }

    // Generate verification code (keep existing logic)
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Development bypass: Auto-verify if enabled
    const devVerificationStatus = getDevVerificationStatus();

    // Create user with Prisma (enhanced with dev bypass)
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        is_verified: devVerificationStatus.is_verified, // Auto-verify in dev mode
        verification_code: verificationCode,
        role: "user", // Default role from schema
        subscriptionStatus: "inactive" // Default subscription status
      }
    });

    // Email handling with development bypass
    const emailEnabled = process.env.ENABLE_EMAIL === 'true';

    if (DEV_BYPASS.SKIP_EMAIL_SENDING) {
      // Development: Use mock email
      console.log('🚀 DEV MODE: Using mock email service');
      const htmlContent = `
        <h2>Email Verification</h2>
        <p>Welcome to TCG Market! Please verify your email address.</p>
        <p>Your verification code is: <strong>${verificationCode}</strong></p>
        <p>Enter this code on the verification page to activate your account.</p>
      `;
      await mockSendEmail(email, "Verify Your TCG Market Account", htmlContent);
    } else if (emailEnabled) {
      // Production: Send actual email (your existing logic)
      try {
        const htmlContent = `
          <h2>Email Verification</h2>
          <p>Welcome to TCG Market! Please verify your email address.</p>
          <p>Your verification code is: <strong>${verificationCode}</strong></p>
          <p>Enter this code on the verification page to activate your account.</p>
        `;
        await sendEmail(email, "Verify Your TCG Market Account", htmlContent);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Continue with registration even if email fails
      }
    } else {
      console.log("Email disabled - verification code:", verificationCode);
    }

    // Response message based on mode
    const responseMessage = DEV_BYPASS.AUTO_VERIFY_USERS
      ? "User registered and automatically verified for development."
      : "User registered successfully. Please check your email to verify.";

    return NextResponse.json({
      message: responseMessage,
      userId: newUser.id,
      ...(DEV_BYPASS.AUTO_VERIFY_USERS && { devMode: true, autoVerified: true })
    }, { status: 201 });

  } catch (error) {
    console.error("Database or email error:", error);

    // Handle Prisma-specific errors (keep existing logic)
    if (error instanceof Error) {
      // Check for unique constraint violation (P2002 is Prisma's unique constraint error)
      if (error.message.includes('P2002')) {
        return NextResponse.json({ message: "Email is already registered." }, { status: 400 });
      }
    }

    return NextResponse.json({ message: "An error occurred while registering the user." }, { status: 500 });
  }
}