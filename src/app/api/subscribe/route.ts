import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../lib/email";

const prisma = new PrismaClient();

interface WaitlistMetadata {
  source: string;
  timestamp: string;
  ip_address: string;
  timezone: string;
  browser: {
    name: string;
    version: string;
    os: string;
    osVersion: string;
    device: string;
    deviceModel: string;
  };
}

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

    // Get client IP address
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || request.headers.get("x-client-ip") || "unknown";

    // Get timezone information
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Format signup time with timezone
    const signupTime = new Date().toLocaleString("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      timeZoneName: "short",
    });

    // Browser and device information (placeholders for server-side)
    const browserDetails = {
      name: "Unknown Browser",
      version: "Unknown Version",
      os: "Unknown OS",
      osVersion: "Unknown Version",
      device: "Unknown Device",
      deviceModel: "Unknown Model",
    };

    // Check if email already exists in waitlist
    const existingWaitlist = await prisma.waitlist.findUnique({ where: { email } });

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
            ip_address: ip,
            timezone,
            browser: browserDetails,
          },
        },
      });
      console.log(`[${timestamp}] No email notification sent for existing user: email=${email}`);
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
            ip_address: ip,
            timezone,
            browser: browserDetails,
          },
        },
      });

      console.log(`[${timestamp}] Attempting to send email notification to derekgallardo01@gmail.com for email=${email}`);
      try {
        await sendEmail("derekgallardo01@gmail.com", "New TCG Market Waitlist Signup", `
          <h2>New Waitlist Signup</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Source:</strong> Landing Page</p>
          <p><strong>Signup Time:</strong> ${signupTime}</p>
          <p><strong>Timezone:</strong> ${timezone}</p>
          <p><strong>IP Address:</strong> ${ip}</p>
          <p><strong>Browser:</strong> ${browserDetails.name} ${browserDetails.version}</p>
          <p><strong>OS:</strong> ${browserDetails.os} ${browserDetails.osVersion}</p>
          <p><strong>Device:</strong> ${browserDetails.device} ${browserDetails.deviceModel}</p>
          <p><strong>Status:</strong> New Signup</p>
        `);
        console.log(`[${timestamp}] Email notification sent successfully to derekgallardo01@gmail.com for email=${email}`);
      } catch (error) {
        console.error(`[${timestamp}] Failed to send email notification to derekgallardo01@gmail.com for email=${email}:`, {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
          code: error.code,
        });
      }
    }

    console.log(`[${timestamp}] Signup completed successfully: email=${email}, id=${waitlistEntry.id}`);
    return NextResponse.json({
      success: true,
      message: existingWaitlist ? "Waitlist entry updated successfully" : "Successfully added to waitlist",
      data: {
        id: waitlistEntry.id,
        created_at: waitlistEntry.createdAt,
        metadata: waitlistEntry.metadata,
      },
    });
  } catch (error) {
    console.error(`[${timestamp}] Signup failed for email=${email || "unknown"}:`, {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      code: error.code,
    });
    return NextResponse.json(
      { error: "Failed to process waitlist signup" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}