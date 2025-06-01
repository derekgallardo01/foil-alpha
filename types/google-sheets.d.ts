export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
}

export class GoogleSheets {
  constructor(config: GoogleSheetsConfig);

  getEntries(): Promise<any[]>;
  addEntry(entry: any): Promise<void>;
  updateEntry(entry: any): Promise<void>;
  deleteEntry(email: string): Promise<void>;
}
