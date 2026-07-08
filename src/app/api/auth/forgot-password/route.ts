import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";
import { sendEmail } from "../../../lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || email.trim() === "") {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    // Generic response either way, so this can't be used to probe which emails exist.
    const generic = { message: "If an account exists, a password reset link has been sent to your email." };

    const user = await prisma.user.findUnique({ where: { email: sanitizedEmail }, select: { id: true } });
    if (!user) return NextResponse.json(generic, { status: 200 });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetLink = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${resetToken}`;
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.resetToken.create({ data: { email: sanitizedEmail, token: resetToken, expires } });

    const htmlContent = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your Foil Alpha account.</p>
      <p><a href="${resetLink}" style="color: #9B5Cff;">Click here to reset your password</a></p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    await sendEmail(sanitizedEmail, "Password Reset Request", htmlContent);

    return NextResponse.json(generic, { status: 200 });
  } catch (error) {
    console.error("Error sending reset email:", error);
    return NextResponse.json({ message: "Something went wrong. Please try again later." }, { status: 500 });
  }
}
