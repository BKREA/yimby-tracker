"""Google Sheets client: read existing Link column, append new rows."""
from __future__ import annotations

import json
import os

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Column order in the sheet. Header row is written automatically if the sheet is empty.
HEADERS = ["Address", "Developer", "Link", "Neighborhood", "Borough", "Notes", "Complete Article"]
LINK_COL_INDEX = HEADERS.index("Link")  # 2 (zero-based) -> column C


def _credentials():
    """Build credentials from either GOOGLE_SERVICE_ACCOUNT_JSON env (inline JSON) or a file path."""
    inline = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if inline:
        info = json.loads(inline)
        return Credentials.from_service_account_info(info, scopes=SCOPES)
    path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service-account.json")
    return Credentials.from_service_account_file(path, scopes=SCOPES)


class Sheet:
    def __init__(self, spreadsheet_id: str, sheet_name: str = "Sheet1"):
        self.spreadsheet_id = spreadsheet_id
        self.sheet_name = sheet_name
        self._svc = build("sheets", "v4", credentials=_credentials(), cache_discovery=False)

    def ensure_header(self) -> None:
        rng = f"{self.sheet_name}!A1:{chr(ord('A') + len(HEADERS) - 1)}1"
        resp = (
            self._svc.spreadsheets()
            .values()
            .get(spreadsheetId=self.spreadsheet_id, range=rng)
            .execute()
        )
        existing = resp.get("values", [])
        if not existing or existing[0] != HEADERS:
            self._svc.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=rng,
                valueInputOption="RAW",
                body={"values": [HEADERS]},
            ).execute()

    def existing_links(self) -> set[str]:
        # Read whole Link column (skip header).
        col_letter = chr(ord("A") + LINK_COL_INDEX)
        rng = f"{self.sheet_name}!{col_letter}2:{col_letter}"
        resp = (
            self._svc.spreadsheets()
            .values()
            .get(spreadsheetId=self.spreadsheet_id, range=rng)
            .execute()
        )
        rows = resp.get("values", [])
        return {r[0] for r in rows if r and r[0]}

    def append_rows(self, rows: list[list[str]]) -> None:
        if not rows:
            return
        self._svc.spreadsheets().values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"{self.sheet_name}!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": rows},
        ).execute()
