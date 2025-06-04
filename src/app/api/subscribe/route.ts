import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { sendEmail } from "../../lib/email";
import mailchimp from "@mailchimp/mailchimp_marketing";
import { GoogleSheets } from "../../lib/google-sheets";

const prisma = new PrismaClient();

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_API_KEY?.split("-")[1] || "",
});

const googleSheets = new GoogleSheets();

interface EmailData {
  subject: string;
  body: string;
}

interface RequestBody {
  name: string;
  email: string;
  emailData?: EmailData;
}

interface ErrorWithResponse extends Error {
  response?: { data?: unknown };
  code?: string;
}

function isErrorWithResponse(error: unknown): error is ErrorWithResponse {
  return typeof error === "object" && error !== null && "message" in error;
}

export async function POST(request: Request) {
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  let signupEmail = "unknown";

  try {
    // Validate environment variables
    const requiredEnvVars = [
      "MAILCHIMP_API_KEY",
      "MAILCHIMP_LIST_ID",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "DATABASE_URL",
    ];
    const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      console.error(`[${timestamp}] Missing environment variables:`, missingEnvVars);
      throw new Error(`Missing environment variables: ${missingEnvVars.join(", ")}`);
    }

    const body: RequestBody = await request.json();
    const { name, email, emailData } = body;
    signupEmail = email;

    console.log(`[${timestamp}] Signup attempt: email=${signupEmail}, name=${name}`);
    console.log(`[${timestamp}] Email data received:`, emailData ? "Yes" : "No");

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

    // Placeholder browser details (replace with actual detection if needed)
    const browserDetails = {
      name: "Unknown Browser",
      version: "Unknown Version",
      os: "Unknown OS",
      osVersion: "Unknown Version",
      device: "Unknown Device",
      deviceModel: "Unknown Model",
    };

    let waitlistEntry;
    try {
      const existingWaitlist = await prisma.waitlist.findUnique({ where: { email: signupEmail } });

      if (existingWaitlist) {
        console.log(`[${timestamp}] Updating existing waitlist entry for email=${signupEmail}`);
        waitlistEntry = await prisma.waitlist.update({
          where: { email: signupEmail },
          data: {
            name,
            status: "SUBSCRIBED",
            source: "WEBSITE",
            metadata: {
              ...(typeof existingWaitlist.metadata === "object" && existingWaitlist.metadata !== null
                ? existingWaitlist.metadata
                : {}),
              updated: true,
              timezone,
              timestamp: signupTime,
              ip_address: ip,
            },
          },
        });

        try {
          console.log(`[${timestamp}] Updating Google Sheets entry for email=${signupEmail}`);
          await googleSheets.updateEntry({
            id: existingWaitlist.id,
            email: signupEmail,
            name,
            status: "SUBSCRIBED",
            source: "WEBSITE",
            created_at: existingWaitlist.created_at,
            metadata: {
              ...(typeof existingWaitlist.metadata === "object" && existingWaitlist.metadata !== null
                ? existingWaitlist.metadata
                : {}),
              updated: true,
              timezone,
              timestamp: signupTime,
              ip_address: ip,
            },
          });
          console.log(`[${timestamp}] Successfully updated Google Sheets for email=${signupEmail}`);
        } catch (sheetsError) {
          console.error(`[${timestamp}] Failed to update Google Sheets:`, {
            message: isErrorWithResponse(sheetsError) ? sheetsError.message : String(sheetsError),
            stack: isErrorWithResponse(sheetsError) ? sheetsError.stack : undefined,
          });
        }

        if (emailData) {
          try {
            console.log(`[${timestamp}] Sending confirmation email to ${signupEmail}`);
            await sendEmail(signupEmail, emailData.subject, emailData.body);
            console.log(`[${timestamp}] Confirmation email sent successfully to ${signupEmail}`);
          } catch (error) {
            console.error(`[${timestamp}] Failed to send confirmation email:`, error as Error);
          }
        } else {
          console.log(`[${timestamp}] No email data provided for ${signupEmail}`);
        }

        console.log(`[${timestamp}] Signup completed successfully: id=${existingWaitlist.id}`);
      } else {
        console.log(`[${timestamp}] Creating new waitlist entry for email=${signupEmail}`);
        waitlistEntry = await prisma.waitlist.create({
          data: {
            name,
            email: signupEmail,
            status: "SUBSCRIBED",
            source: "WEBSITE",
            metadata: {
              source: "landing_page",
              browser: browserDetails,
              timezone,
              timestamp,
              ip_address: ip,
            },
          },
        });

        if (emailData) {
          try {
            console.log(`[${timestamp}] Sending confirmation email to ${signupEmail}`);
            await sendEmail(signupEmail, emailData.subject, emailData.body);
            console.log(`[${timestamp}] Confirmation email sent successfully to ${signupEmail}`);
          } catch (error) {
            console.error(`[${timestamp}] Failed to send confirmation email:`, error as Error);
          }
        } else {
          console.log(`[${timestamp}] No email data provided for ${signupEmail}`);
        }

        let mailchimpStatus = "Failed";
        try {
          await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID!, {
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
            message: isErrorWithResponse(mailchimpError) ? mailchimpError.message : String(mailchimpError),
            stack: isErrorWithResponse(mailchimpError) ? mailchimpError.stack : undefined,
            response: isErrorWithResponse(mailchimpError) ? mailchimpError.response?.data : undefined,
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
            message: isErrorWithResponse(emailError) ? emailError.message : String(emailError),
            stack: isErrorWithResponse(emailError) ? emailError.stack : undefined,
            response: isErrorWithResponse(emailError) ? emailError.response?.data : undefined,
            code: isErrorWithResponse(emailError) ? emailError.code : undefined,
          });
        }

        try {
          await googleSheets.addEntry({
            id: waitlistEntry.id,
            email: signupEmail,
            name,
            status: "SUBSCRIBED",
            created_at: waitlistEntry.created_at || new Date(),
            source: "WEBSITE",
            metadata: typeof waitlistEntry.metadata === "object" && waitlistEntry.metadata !== null
              ? waitlistEntry.metadata as Record<string, unknown>
              : {},
          });
          console.log(`[${timestamp}] Successfully added to Google Sheets`);
        } catch (sheetsError) {
          console.error(`[${timestamp}] Failed to sync with Google Sheets:`, {
            message: isErrorWithResponse(sheetsError) ? sheetsError.message : String(sheetsError),
            stack: isErrorWithResponse(sheetsError) ? sheetsError.stack : undefined,
          });
        }

        console.log(`[${timestamp}] Signup completed successfully: id=${waitlistEntry.id}`);
      }

      return NextResponse.json({
        success: true,
        message: existingWaitlist ? "Waitlist entry updated successfully" : "Successfully added to waitlist",
        data: {
          id: waitlistEntry.id,
          created_at: waitlistEntry.created_at,
          metadata: waitlistEntry.metadata,
        },
      });
    } catch (prismaError) {
      if (prismaError instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(`[${timestamp}] Prisma error for email=${signupEmail}:`, {
          code: prismaError.code,
          message: prismaError.message,
          meta: prismaError.meta,
        });
        if (prismaError.message.includes("does not exist in the current database")) {
          return NextResponse.json({ error: "Database table not found. Contact support." }, { status: 500 });
        }
      }
      throw prismaError; // Rethrow other errors
    }
  } catch (error) {
    console.error(`[${timestamp}] Signup failed for email=${signupEmail}:`, {
      message: isErrorWithResponse(error) ? error.message : String(error),
      stack: isErrorWithResponse(error) ? error.stack : undefined,
      response: isErrorWithResponse(error) ? error.response?.data : undefined,
    });
    return NextResponse.json({ error: "Failed to process waitlist signup" }, { status: 500 });
  } finally {
    await prisma.$disconnect().catch((err) => {
      console.error(`[${timestamp}] Failed to disconnect Prisma client:`, err);
    });
  }
}