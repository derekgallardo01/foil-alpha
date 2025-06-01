import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../lib/email";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  try {
    const { name, email } = await request.json();

    // Log signup attempt
    console.log(`[${timestamp}] Signup attempt: email=${email}, name=${name}`);

    // Validate input
    if (!name || !email) {
      console.log(`[${timestamp}] Validation failed: Missing name or email - email=${email || "unknown"}, name=${name || "unknown"}`);
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Server-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`[${timestamp}] Validation failed: Invalid email format - email=${email}`);
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Check if email already exists in waitlist
    const existingWaitlist = await prisma.waitlist.findUnique({
      where: { email },
    });

    let waitlistEntry;
    if (existingWaitlist) {
      console.log(`[${timestamp}] Updating existing waitlist entry for email=${email}`);
      waitlistEntry = await prisma.waitlist.update({
        where: { email },
        data: {
          name,
          status: "PENDING",
          source: "WEBSITE",
          metadata: {
            source: "landing_page",
            timestamp: new Date().toISOString(),
            updated: true,
          },
        },
      });
    } else {
      console.log(`[${timestamp}] Creating new waitlist entry for email=${email}`);
      waitlistEntry = await prisma.waitlist.create({
        data: {
          email,
          name,
          status: "PENDING",
          source: "WEBSITE",
          metadata: {
            source: "landing_page",
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    // Send email notification to admin
    const adminEmail = "derekgallardo01@gmail.com";
    const emailSubject = "New TCG Market Waitlist Signup";
    const emailContent = `
      <h2>New Waitlist Signup</h2>
      <p>Name: ${name}</p>
      <p>Email: ${email}</p>
      <p>Source: Landing Page</p>
      <p>Signup Time: ${timestamp}</p>
      <p>Status: ${existingWaitlist ? 'Updated' : 'New Signup'}</p>
    `;

    console.log(`[${timestamp}] Attempting to send email notification to ${adminEmail} for email=${email}`);
    try {
      await sendEmail(adminEmail, emailSubject, emailContent);
      console.log(`[${timestamp}] Email notification sent successfully to ${adminEmail} for email=${email}`);
    } catch (error) {
      console.error(`[${timestamp}] Failed to send email notification to ${adminEmail} for email=${email}:`, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        code: error.code,
      });
    }

    console.log(`[${timestamp}] Signup completed successfully: email=${email}, id=${waitlistEntry.id}`);
    return NextResponse.json({
      success: true,
      message: existingWaitlist
        ? "Waitlist entry updated successfully"
        : "Successfully added to waitlist",
      data: {
        id: waitlistEntry.id,
        created_at: waitlistEntry.createdAt,
      },
    });
  } catch (error) {
    console.error(`[${timestamp}] Signup failed for email=${email || "unknown"}:`, {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}