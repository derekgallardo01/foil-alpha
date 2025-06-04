import { google } from "googleapis";
import { JWT } from "google-auth-library";

// Define a custom error interface for Google API errors
interface GoogleApiError extends Error {
  code?: number | string;
}

interface WaitlistEntry {
  id: number;
  name: string;
  email: string;
  status: string;
  created_at: Date;
  source: string;
  metadata: Record<string, unknown>;
}

export class GoogleSheets {
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private sheetName: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || "";
    this.sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "Sheet1";

    // Validate environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is not set");
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error("GOOGLE_PRIVATE_KEY is not set");
    }
    if (!this.spreadsheetId) {
      throw new Error("GOOGLE_SHEETS_ID is not set");
    }
    if (!this.sheetName) {
      throw new Error("GOOGLE_SHEETS_SHEET_NAME is not set");
    }

    // Log configuration for debugging
    console.log("Google Sheets Config:", {
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKeySet: process.env.GOOGLE_PRIVATE_KEY ? "SET" : "NOT SET",
      spreadsheetId: this.spreadsheetId,
      sheetName: this.sheetName,
    });

    // Initialize Google Sheets API
    try {
      const jwtClient = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      this.sheets = google.sheets({
        version: "v4",
        auth: jwtClient,
      });
    } catch (error: unknown) {
      console.error("Error initializing Google Sheets API:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as GoogleApiError).code,
      });
      throw error;
    }
  }

  private async ensureHeaders(): Promise<void> {
    try {
      const range = this.sheetName.includes(" ")
        ? `'${this.sheetName}'!A:G`
        : `${this.sheetName}!A:G`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const values = response.data.values || [];
      if (values.length === 0 || values[0].length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                "Name",
                "Email",
                "Status",
                "Source",
                "Created At",
                "Metadata",
                "ID",
              ],
            ],
          },
        });
        console.log("Added headers to Google Sheets");
      }
    } catch (error: unknown) {
      console.error("Error ensuring headers in Google Sheets:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as GoogleApiError).code,
      });
      throw error;
    }
  }

  private entryToRow(entry: WaitlistEntry): string[] {
    return [
      entry.name,
      entry.email,
      entry.status,
      entry.source,
      entry.created_at.toISOString(),
      JSON.stringify(entry.metadata),
      entry.id.toString(),
    ];
  }

  private rowToEntry(row: string[]): WaitlistEntry {
    return {
      name: row[0] || "",
      email: row[1] || "",
      status: row[2] || "",
      source: row[3] || "",
      created_at: row[4] ? new Date(row[4]) : new Date(),
      metadata: row[5] ? JSON.parse(row[5]) : {},
      id: row[6] ? parseInt(row[6], 10) : 0,
    };
  }

  async getEntries(): Promise<WaitlistEntry[]> {
    try {
      const range = this.sheetName.includes(" ")
        ? `'${this.sheetName}'!A:G`
        : `${this.sheetName}!A:G`;
      console.log("Fetching entries with range:", range);
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      return rows.slice(1).map((row) => this.rowToEntry(row));
    } catch (error: unknown) {
      console.error("Error getting entries from Google Sheets:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as GoogleApiError).code,
      });
      if ((error as Error).message.includes("Requested entity was not found")) {
        throw new Error(
          `Spreadsheet or sheet not found. Verify spreadsheetId: ${this.spreadsheetId} and sheetName: ${this.sheetName}`,
        );
      }
      throw error;
    }
  }

  async addEntry(entry: WaitlistEntry): Promise<void> {
    try {
      console.log("Adding entry to Google Sheets:", entry);
      await this.ensureHeaders();
      const row = this.entryToRow(entry);
      const range = this.sheetName.includes(" ")
        ? `'${this.sheetName}'!A:G`
        : `${this.sheetName}!A:G`;
      console.log("Appending entry with range:", range);

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [row],
        },
      });

      console.log("Successfully added entry to Google Sheets:", entry.email);
    } catch (error: unknown) {
      console.error("Error adding entry to Google Sheets:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as GoogleApiError).code,
      });
      if ((error as Error).message.includes("Unable to parse range")) {
        throw new Error(
          `Invalid sheet name: ${this.sheetName}. Ensure the sheet exists and the name is correct.`,
        );
      }
      if ((error as Error).message.includes("Requested entity was not found")) {
        throw new Error(
          `Spreadsheet or sheet not found. Verify spreadsheetId: ${this.spreadsheetId} and sheetName: ${this.sheetName}`,
        );
      }
      throw error;
    }
  }

  async updateEntry(entry: WaitlistEntry): Promise<void> {
    try {
      await this.ensureHeaders();
      const entries = await this.getEntries();
      const index = entries.findIndex((e) => e.email === entry.email);

      if (index >= 0) {
        const range = this.sheetName.includes(" ")
          ? `'${this.sheetName}'!A${index + 2}:G${index + 2}`
          : `${this.sheetName}!A${index + 2}:G${index + 2}`;
        console.log("Updating entry with range:", range);
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: {
            values: [this.entryToRow(entry)],
          },
        });
        console.log("Successfully updated entry in Google Sheets:", entry.email);
      }
    } catch (error: unknown) {
      console.error("Error updating entry in Google Sheets:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as GoogleApiError).code,
      });
      if ((error as Error).message.includes("Requested entity was not found")) {
        throw new Error(
          `Spreadsheet or sheet not found. Verify spreadsheetId: ${this.spreadsheetId} and sheetName: ${this.sheetName}`,
        );
      }
      throw error;
    }
  }

  async deleteEntry(email: string): Promise<void> {
    try {
      const entries = await this.getEntries();
      const index = entries.findIndex((e) => e.email === email);

      if (index >= 0) {
        const range = this.sheetName.includes(" ")
          ? `'${this.sheetName}'!A${index + 2}:G${index + 2}`
          : `${this.sheetName}!A${index + 2}:G${index + 2}`;
        console.log("Deleting entry with range:", range);
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            data: [
              {
                range,
                values: [["", "", "", "", "", "", ""]],
              },
            ],
          },
        });
        console.log("Successfully deleted entry from Google Sheets:", email);
      }
    } catch (error: unknown) {
      console.error("Error deleting entry from Google Sheets:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        code: (error as GoogleApiError).code,
      });
      if ((error as Error).message.includes("Requested entity was not found")) {
        throw new Error(
          `Spreadsheet or sheet not found. Verify spreadsheetId: ${this.spreadsheetId} and sheetName: ${this.sheetName}`,
        );
      }
      throw error;
    }
  }
}