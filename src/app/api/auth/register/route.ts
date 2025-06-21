import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { sendEmail } from "../../../lib/email";
import { DEV_BYPASS, mockSendEmail } from "../../../lib/dev-bypass";

// Define the User type based on your Prisma schema
interface UserRegistrationData {
  email: string;
  password: string;
  name: string;
}

export async function POST(req: Request) {
  const { email, password, name }: UserRegistrationData = await req.json();

  // Validate input
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
    // Check for existing email using Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 400 });
    }

    // Generate verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with Prisma
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        is_verified: DEV_BYPASS.AUTO_VERIFY_USERS ? true : false,
        verification_code: verificationCode,
        role: "user",
        subscriptionStatus: "active"
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
      await mockSendEmail(email, htmlContent);
    } else if (emailEnabled) {
      // Production: Send actual email
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

    // Handle Prisma-specific errors
    if (error instanceof Error) {
      if (error.message.includes('P2002')) {
        return NextResponse.json({ message: "Email is already registered." }, { status: 400 });
      }
    }

    return NextResponse.json({ message: "An error occurred while registering the user." }, { status: 500 });
  }
}