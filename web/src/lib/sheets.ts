import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing env: GOOGLE_SERVICE_ACCOUNT_JSON");
  const info = JSON.parse(raw);
  return new google.auth.GoogleAuth({ credentials: info, scopes: SCOPES });
}

export interface SheetRow {
  address: string;
  developer: string;
  link: string;
  neighborhood: string;
  borough: string;
  notes: string;
  // Article body intentionally omitted from preview to keep payload small.
}

export async function recentRows(limit = 25): Promise<SheetRow[]> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing env: SHEET_ID");
  const tab = process.env.SHEET_TAB ?? "Sheet1";

  const auth = credentials();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A2:F`,
  });
  const rows = res.data.values ?? [];
  return rows
    .slice(-limit)
    .reverse()
    .map((r) => ({
      address: r[0] ?? "",
      developer: r[1] ?? "",
      link: r[2] ?? "",
      neighborhood: r[3] ?? "",
      borough: r[4] ?? "",
      notes: r[5] ?? "",
    }));
}

export async function rowCount(): Promise<number> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing env: SHEET_ID");
  const tab = process.env.SHEET_TAB ?? "Sheet1";

  const auth = credentials();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!C2:C`,
  });
  return (res.data.values ?? []).length;
}
