import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../lib/email";
import mailchimp from "@mailchimp/mailchimp_marketing";

const prisma = new PrismaClient();

// Initialize Mailchimp client
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_API_KEY?.split("-")[1], // Extract server prefix (e.g., us16)
});

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
    const signupEmail = email; // Store email for consistent use

    // Log signup attempt
    console.log(`[${timestamp}] Signup attempt: email=${signupEmail}, name=${name}`);

    // Validate input
    if (!name || !signupEmail) {
      console.log(`[${timestamp}] Validation failed: Missing name or email - email=${signupEmail || "unknown"}, name=${name || "unknown"}`);
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Server-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) {
      console.log(`[${timestamp}] Validation failed: Invalid email format - email=${signupEmail}`);
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
    const existingWaitlist = await prisma.waitlist.findUnique({ where: { email: signupEmail } });

    let waitlistEntry;
    if (existingWaitlist) {
      console.log(`[${timestamp}] Updating existing waitlist entry for email=${signupEmail}`);
      waitlistEntry = await prisma.waitlist.update({
        where: { email: signupEmail },
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
      console.log(`[${timestamp}] No email notification sent for existing user: email=${signupEmail}`);
    } else {
      console.log(`[${timestamp}] Creating new waitlist entry for email=${signupEmail}`);
      waitlistEntry = await prisma.waitlist.create({
        data: {
          email: signupEmail,
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

      console.log(`[${timestamp}] Attempting to send email notification to derekgallardo01@gmail.com for email=${signupEmail}`);
      let mailchimpStatus = "Failed";
      try {
        // Add user to Mailchimp list
        if (!process.env.MAILCHIMP_LIST_ID) {
          console.error(`[${timestamp}] MAILCHIMP_LIST_ID is not set in environment variables`);
          throw new Error("MAILCHIMP_LIST_ID is not set");
        }
        await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
          email_address: signupEmail,
          status: "subscribed",
          merge_fields: {
            FNAME: name,
            IP: ip,
            SOURCE: "website",
            TIMEZONE: timezone,
            DEVICE: `${browserDetails.device} ${browserDetails.deviceModel}`,
            BROWSER: `${browserDetails.name} ${browserDetails.version}`,
            OS: `${browserDetails.os} ${browserDetails.osVersion}`,
          },
        });
        mailchimpStatus = "Success";
        console.log(`[${timestamp}] Successfully added ${signupEmail} to Mailchimp list`);
      } catch (mailchimpError) {
        console.error(`[${timestamp}] Failed to add to Mailchimp list for email=${signupEmail}:`, {
          message: mailchimpError.message,
          stack: mailchimpError.stack,
          response: mailchimpError.response?.data || mailchimpError.response?.body,
          code: mailchimpError.code,
        });
      }

      try {
        // Send email notification with Mailchimp status
        await sendEmail("derekgallardo01@gmail.com", "New TCG Market Waitlist Signup", `
          <h2>New Waitlist Signup</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${signupEmail}</p>
          <p><strong>Source:</strong> Landing Page</p>
          <p><strong>Signup Time:</strong> ${signupTime}</p>
          <p><strong>Timezone:</strong> ${timezone}</p>
          <p><strong>IP Address:</strong> ${ip}</p>
          <p><strong>Browser:</strong> ${browserDetails.name} ${browserDetails.version}</p>
          <p><strong>OS:</strong> ${browserDetails.os} ${browserDetails.osVersion}</p>
          <p><strong>Device:</strong> ${browserDetails.device} ${browserDetails.deviceModel}</p>
          <p><strong>Mailchimp Status:</strong> ${mailchimpStatus}</p>
          <p><strong>Status:</strong> New Signup</p>
        `);
        console.log(`[${timestamp}] Email notification sent successfully to derekgallardo01@gmail.com for email=${signupEmail}`);
      } catch (emailError) {
        console.error(`[${timestamp}] Failed to send email notification to derekgallardo01@gmail.com for email=${signupEmail}:`, {
          message: emailError.message,
          stack: emailError.stack,
          response: emailError.response?.data,
          code: emailError.code,
        });
      }
    }

    console.log(`[${timestamp}] Signup completed successfully: email=${signupEmail}, id=${waitlistEntry.id}`);
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
    console.error(`[${timestamp}] Signup failed for email=${signupEmail || "unknown"}:`, {
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