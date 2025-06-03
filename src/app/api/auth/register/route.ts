import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDbConnection } from "../../../lib/db";
import { sendEmail } from "../../../lib/email";

// Define the User type based on your database schema
interface User {
  id?: number;
  email: string;
  password: string;
  name: string;
  is_verified: number;
  verification_code: string;
}

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

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

  const connection = await getDbConnection();

  try {
    // Check for existing email
    const [rows]: [User[], unknown] = await connection.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length > 0) {
      return NextResponse.json({ message: "Email is already registered." }, { status: 400 });
    }

    // Generate verification code
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user with unverified status
    await connection.execute(
      "INSERT INTO users (email, password, name, is_verified, verification_code) VALUES (?, ?, ?, ?, ?)",
      [email, hashedPassword, name, 0, verificationCode]
    );

    // Send verification email
    const htmlContent = `
      <h2>Email Verification</h2>
      <p>Welcome to TCG Market! Please verify your email address.</p>
      <p>Your verification code is: <strong>${verificationCode}</strong></p>
      <p>Enter this code on the verification page to activate your account.</p>
    `;
    await sendEmail(email, "Verify Your TCG Market Account", htmlContent);

    return NextResponse.json({ message: "User registered successfully. Please check your email to verify." }, { status: 201 });
  } catch (error) {
    console.error("Database or email error:", error);
    return NextResponse.json({ message: "An error occurred while registering the user." }, { status: 500 });
  } finally {
    await connection.end();
  }
}