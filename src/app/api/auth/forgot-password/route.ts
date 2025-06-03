import { NextRequest, NextResponse } from "next/server";
import { getDbConnection } from "../../../lib/db";
import crypto from "crypto";
import { sendEmail } from "../../../lib/email";

// Define the User interface
interface User {
  id: number;
  email: string;
  password: string;
  // Add other fields as needed
}

export async function POST(req: NextRequest) {
  const connection = await getDbConnection();

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || email.trim() === "") {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const [users]: [User[], unknown] = await connection.execute("SELECT * FROM users WHERE email = ?", [sanitizedEmail]);
    if (users.length === 0) {
      return NextResponse.json(
        { message: "If an account exists, a password reset link has been sent to your email." },
        { status: 200 }
      );
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetLink = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${resetToken}`;
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await connection.execute(
      "INSERT INTO reset_tokens (email, token, expires) VALUES (?, ?, ?)",
      [sanitizedEmail, resetToken, expires]
    );

    const htmlContent = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your TCG Market account.</p>
      <p><a href="${resetLink}" style="color: #96ff9b;">Click here to reset your password</a></p>
      <p>If you didn’t request this, please ignore this email.</p>
    `;
    await sendEmail(sanitizedEmail, "Password Reset Request", htmlContent);

    return NextResponse.json(
      { message: "If an account exists, a password reset link has been sent to your email." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending reset email:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  } finally {
    await connection.end();
  }
}