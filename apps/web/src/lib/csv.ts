/**
 * Small RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF) - enough for bulk imports without a dependency.
 * Returns rows as objects keyed by the lower-cased header row.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) records.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) records.push(row);

  const [head, ...body] = records;
  const headers = (head ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const rows = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
export function toCsv(headers: string[], rows: (string | number)[][]) {
  return [headers, ...rows].map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
}

/** Accept a .csv or .json file: JSON may be an array of objects or `{ rows: [...] }`. */
export async function readRows(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{")) {
    const data = JSON.parse(text) as unknown;
    const arr = Array.isArray(data) ? data : (data as { rows?: unknown[] }).rows;
    if (!Array.isArray(arr)) throw new Error("The JSON file must contain an array of rows.");
    return arr as Record<string, unknown>[];
  }
  return parseCsv(text).rows;
}
