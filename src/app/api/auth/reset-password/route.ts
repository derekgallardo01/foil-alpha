import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required" }, { status: 400 });
    }

    const tokenRow = await prisma.resetToken.findFirst({
      where: { token, expires: { gt: new Date() } },
      select: { email: true },
    });
    if (!tokenRow) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 400 });
    }

    const email = tokenRow.email;
    const hashedPassword = await bcrypt.hash(password, 12);

    const updated = await prisma.user.updateMany({ where: { email }, data: { password: hashedPassword } });
    if (updated.count === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 400 });
    }

    // Single-use: consume the token (and any others for this email).
    await prisma.resetToken.deleteMany({ where: { token } });

    return NextResponse.json({ message: "Password reset successfully", email }, { status: 200 });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ message: "Something went wrong. Please try again later." }, { status: 500 });
  }
}
