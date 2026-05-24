/** Convert a 2D array of cells into a CSV string. RFC 4180 quoting. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return "";
    const s = String(cell);
    // Quote if the cell contains a comma, quote, CR, or LF.
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

/** Trigger a browser download for a string of text content. */
export function downloadText(filename: string, content: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
