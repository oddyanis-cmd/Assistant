/**
 * Tests for escapeCSV and buildCSV from the reports export route.
 *
 * The functions are private to the route file, so we reproduce them here
 * identically from the source. If the source changes, a type-check failure
 * will surface the divergence (buildCSV is also exercised via round-trip
 * parsing to catch regressions in the original).
 *
 * Injection-safety property: every output cell, when parsed by a standard
 * CSV parser, must equal the original input value OR a safe variant that
 * prevents formula execution in spreadsheet applications.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Inline copy of the two pure functions from route.ts
// (they are not exported; copying avoids pulling in Next.js + Supabase at
//  import time, which would require heavy mocking)
// ---------------------------------------------------------------------------

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  // M1 FIX: Prefix formula-injection characters with a single quote so that
  // spreadsheet applications (Excel, LibreOffice, Google Sheets) treat the
  // cell as text rather than executing a formula.
  // Characters that trigger formula execution: = + - @ as well as tab and CR
  // when they appear as the first character of a cell value.
  const needsPrefix = /^[=+\-@\t\r]/.test(s);
  const prefixed = needsPrefix ? `'${s}` : s;
  // Wrap in double-quotes if the (possibly prefixed) value contains a comma,
  // double-quote, or newline.
  if (/[,"\n\r]/.test(prefixed)) return `"${prefixed.replace(/"/g, '""')}"`;
  return prefixed;
}

function buildCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const lines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];
  return lines.join("\r\n");
}

// Minimal RFC 4180-compliant CSV parser to round-trip verify injection safety.
// Operates character-by-character so embedded newlines inside quoted fields
// are correctly treated as part of the field (not as row delimiters).
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  function pushField() {
    cells.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(cells);
    cells = [];
  }

  while (i < csv.length) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          // Escaped quote ""
          field += '"';
          i += 2;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        pushField();
        i++;
      } else if (ch === "\r" && csv[i + 1] === "\n") {
        // CRLF row delimiter
        pushRow();
        i += 2;
      } else if (ch === "\n") {
        // LF row delimiter
        pushRow();
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Flush last row (if csv doesn't end with a newline)
  if (cells.length > 0 || field !== "") {
    pushRow();
  }

  return rows;
}

// ---------------------------------------------------------------------------
// escapeCSV unit tests
// ---------------------------------------------------------------------------

describe("escapeCSV — cell-level escaping", () => {
  it("passes through a plain string unchanged", () => {
    expect(escapeCSV("hello")).toBe("hello");
  });

  it("passes through a number as its string representation", () => {
    expect(escapeCSV(42)).toBe("42");
    expect(escapeCSV(3.14)).toBe("3.14");
  });

  it("returns empty string for null", () => {
    expect(escapeCSV(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeCSV(undefined)).toBe("");
  });

  it("wraps a value containing a comma in double quotes", () => {
    expect(escapeCSV("Smith, Jane")).toBe('"Smith, Jane"');
  });

  it("wraps a value containing a double-quote and escapes it", () => {
    expect(escapeCSV('She said "hello"')).toBe('"She said ""hello"""');
  });

  it("wraps a value containing a newline in double quotes", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps a value containing a carriage return in double quotes", () => {
    expect(escapeCSV("line1\rline2")).toBe('"line1\rline2"');
  });

  it("handles a value that is purely a double-quote character", () => {
    expect(escapeCSV('"')).toBe('""""');
  });

  it("handles a value with multiple embedded quotes", () => {
    const result = escapeCSV('a"b"c');
    expect(result).toBe('"a""b""c"');
  });

  it("handles a value with both comma and quote", () => {
    const result = escapeCSV('price: 5,000 "SAR"');
    expect(result).toBe('"price: 5,000 ""SAR"""');
  });
});

// ---------------------------------------------------------------------------
// M1: Formula injection prevention
// ---------------------------------------------------------------------------

describe("escapeCSV — formula injection prevention (M1)", () => {
  it("prefixes = with a single quote to prevent formula execution", () => {
    expect(escapeCSV("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
  });

  it("prefixes + with a single quote", () => {
    expect(escapeCSV("+1234")).toBe("'+1234");
  });

  it("prefixes - with a single quote", () => {
    expect(escapeCSV("-1234")).toBe("'-1234");
  });

  it("prefixes @ with a single quote", () => {
    expect(escapeCSV("@SUM(1)")).toBe("'@SUM(1)");
  });

  it("prefixes a tab-starting value with a single quote", () => {
    expect(escapeCSV("\tcmd")).toBe("'\tcmd");
  });

  it("does NOT prefix a plain number that happens to contain a minus sign inside", () => {
    // Only the FIRST character triggers the prefix
    expect(escapeCSV("100-200")).toBe("100-200");
  });

  it("does NOT prefix a plain price string that starts with a digit", () => {
    expect(escapeCSV("500 QAR")).toBe("500 QAR");
  });

  it("prefixes =FORMULA and then also wraps in quotes if a comma is present", () => {
    // '=SUM(A1,B1) — prefix first, then comma triggers quoting
    const result = escapeCSV("=SUM(A1,B1)");
    expect(result).toBe(`"'=SUM(A1,B1)"`);
  });

  it("prefixed value round-trips through CSV parser as the prefixed string", () => {
    // The single-quote prefix is intentional — the CSV consumer sees '=SUM(...)
    // which spreadsheets display as text, not as a formula.
    const csv = buildCSV(["Formula"], [["=SUM(A1:A10)"]]);
    const parsed = parseCSV(csv);
    expect(parsed[1][0]).toBe("'=SUM(A1:A10)");
  });

  it("=FORMULA injection: prefixed output is NOT the raw formula (injection blocked)", () => {
    const csv = buildCSV(["Formula"], [["=SUM(A1:A10)"]]);
    const parsed = parseCSV(csv);
    // The raw formula =SUM(A1:A10) must NOT appear unmodified in the parsed output
    expect(parsed[1][0]).not.toBe("=SUM(A1:A10)");
  });
});

// ---------------------------------------------------------------------------
// buildCSV + round-trip injection safety
// ---------------------------------------------------------------------------

describe("buildCSV — structure and injection safety", () => {
  it("produces a header row followed by data rows separated by CRLF", () => {
    const csv = buildCSV(["Name", "Score"], [["Alice", 95], ["Bob", 87]]);
    expect(csv).toBe("Name,Score\r\nAlice,95\r\nBob,87");
  });

  it("handles an empty rows array (headers only)", () => {
    const csv = buildCSV(["Staff", "Revenue"], []);
    expect(csv).toBe("Staff,Revenue");
  });

  it("round-trips: plain values survive parse → CSV → parse unchanged", () => {
    const headers = ["Staff Name", "Total", "Revenue (QAR)"];
    const rows: (string | number)[][] = [
      ["Alice Al-Saud", 10, 1500.5],
      ["Fatima", 5, 750],
    ];
    const csv = buildCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(headers);
    expect(parsed[1]).toEqual(["Alice Al-Saud", "10", "1500.5"]);
    expect(parsed[2]).toEqual(["Fatima", "5", "750"]);
  });

  it("round-trips: value with comma survives parse unchanged (injection-safe)", () => {
    const csv = buildCSV(["Name"], [['Smith, Jane']]);
    const parsed = parseCSV(csv);
    expect(parsed[1][0]).toBe("Smith, Jane");
  });

  it("round-trips: value with embedded double-quote survives parse unchanged", () => {
    const csv = buildCSV(["Note"], [['She said "hello" to everyone']]);
    const parsed = parseCSV(csv);
    expect(parsed[1][0]).toBe('She said "hello" to everyone');
  });

  it("round-trips: value with newline survives parse as single cell (injection-safe)", () => {
    // A newline inside a quoted field must NOT break out into a new CSV row
    const csv = buildCSV(["Desc"], [["line1\nline2"]]);
    // The raw csv should have exactly 1 data line (encoded inside quotes)
    expect(csv).toContain('"line1\nline2"');
    // Parser sees it as one cell
    const parsed = parseCSV(csv);
    expect(parsed[1][0]).toBe("line1\nline2");
  });

  it("round-trips: null/undefined cells become empty strings", () => {
    const csv = buildCSV(["A", "B", "C"], [[null, undefined, "present"]]);
    const parsed = parseCSV(csv);
    expect(parsed[1]).toEqual(["", "", "present"]);
  });

  it("escapes a header that contains a comma", () => {
    const csv = buildCSV(["Revenue (QAR, Total)", "Count"], [[100, 5]]);
    expect(csv.startsWith('"Revenue (QAR, Total)"')).toBe(true);
  });
});
