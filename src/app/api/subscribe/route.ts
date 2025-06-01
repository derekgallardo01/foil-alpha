import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../lib/email";
import mailchimp from "@mailchimp/mailchimp_marketing";
import { GoogleSheets } from "../../lib/google-sheets";

const prisma = new PrismaClient();

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_API_KEY?.split("-")[1],
});

const googleSheets = new GoogleSheets();

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
  let signupEmail = "unknown";
  try {
    const { name, email } = await request.json();
    signupEmail = email;

    console.log(`[${timestamp}] Signup attempt: email=${signupEmail}, name=${name}`);

    // Validate environment variables
    if (!process.env.MAILCHIMP_API_KEY || !process.env.MAILCHIMP_LIST_ID) {
      console.error(`[${timestamp}] Missing environment variables`, {
        MAILCHIMP_API_KEY: !!process.env.MAILCHIMP_API_KEY,
        MAILCHIMP_LIST_ID: !!process.env.MAILCHIMP_LIST_ID,
      });
      throw new Error("Mailchimp configuration missing");
    }

    // Validate input
    if (!name || !signupEmail) {
      console.log(`[${timestamp}] Validation failed: Missing name or email`);
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) {
      console.log(`[${timestamp}] Validation failed: Invalid email format`);
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-client-ip") ||
      "unknown";

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

    const browserDetails = {
      name: "Unknown Browser",
      version: "Unknown Version",
      os: "Unknown OS",
      osVersion: "Unknown Version",
      device: "Unknown Device",
      deviceModel: "Unknown Model",
    };

    const existingWaitlist = await prisma.waitlist.findUnique({ where: { email: signupEmail } });

    let waitlistEntry;
    if (existingWaitlist) {
      console.log(`[${timestamp}] Updating existing waitlist entry for email=${signupEmail}`);
      waitlistEntry = await prisma.waitlist.update({
        where: { email: signupEmail },
        data: {
          name,
          status: "SUBSCRIBED",
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

      try {
        await googleSheets.updateEntry({
          id: waitlistEntry.id,
          email: signupEmail,
          name,
          status: "SUBSCRIBED",
          created_at: waitlistEntry.createdAt || new Date(),
          source: "WEBSITE",
          metadata: waitlistEntry.metadata,
        });
        console.log(`[${timestamp}] Successfully updated Google Sheets for email=${signupEmail}`);
      } catch (sheetsError) {
        console.error(`[${timestamp}] Failed to update Google Sheets:`, {
          message: sheetsError.message,
          stack: sheetsError.stack,
        });
      }

      console.log(`[${timestamp}] No email notification sent for existing user`);
    } else {
      console.log(`[${timestamp}] Creating new waitlist entry for email=${signupEmail}`);
      waitlistEntry = await prisma.waitlist.create({
        data: {
          email: signupEmail,
          name,
          status: "SUBSCRIBED",
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

      let mailchimpStatus = "Failed";
      try {
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
        console.error(`[${timestamp}] Failed to add to Mailchimp list:`, {
          message: mailchimpError.message,
          stack: mailchimpError.stack,
          response: mailchimpError.response?.data,
        });
      }

      try {
        const emailContent = `
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
        `;
        console.log(`[${timestamp}] Sending email to derekgallardo01@gmail.com`);
        await sendEmail("derekgallardo01@gmail.com", "New TCG Market Waitlist Signup", emailContent);
        console.log(`[${timestamp}] Email notification sent successfully`);
      } catch (emailError) {
        console.error(`[${timestamp}] Failed to send email notification:`, {
          message: emailError.message,
          stack: emailError.stack,
          response: emailError.response?.data,
          code: emailError.code,
        });
        // Continue processing even if email fails
      }

      try {
        await googleSheets.addEntry({
          id: waitlistEntry.id,
          email: signupEmail,
          name,
          status: "SUBSCRIBED",
          created_at: waitlistEntry.createdAt || new Date(),
          source: "WEBSITE",
          metadata: waitlistEntry.metadata,
        });
        console.log(`[${timestamp}] Successfully added to Google Sheets`);
      } catch (sheetsError) {
        console.error(`[${timestamp}] Failed to sync with Google Sheets:`, {
          message: sheetsError.message,
          stack: sheetsError.stack,
        });
      }
    }

    console.log(`[${timestamp}] Signup completed successfully: id=${waitlistEntry.id}`);
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
    console.error(`[${timestamp}] Signup failed for email=${signupEmail}:`, {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    return NextResponse.json({ error: "Failed to process waitlist signup" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}