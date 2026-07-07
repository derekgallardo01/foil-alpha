import { describe, it, expect } from "vitest";
import { toCsv, CsvColumn } from "../csv";

interface Row {
  name: string;
  qty: number | null;
  note: string;
}
const cols: CsvColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "qty", header: "Qty" },
  { key: "note", header: "Note" },
];

describe("toCsv", () => {
  it("emits header + rows", () => {
    const csv = toCsv([{ name: "Pikachu", qty: 2, note: "mint" }], cols);
    expect(csv).toBe("Name,Qty,Note\nPikachu,2,mint");
  });

  it("returns only the header for empty rows", () => {
    expect(toCsv([], cols)).toBe("Name,Qty,Note");
  });

  it("blanks null/undefined cells", () => {
    expect(toCsv([{ name: "X", qty: null, note: "" }], cols)).toBe("Name,Qty,Note\nX,,");
  });

  it("quotes and escapes commas, quotes, and newlines (RFC 4180)", () => {
    const rows: Row[] = [
      { name: "a,b", qty: 1, note: 'he said "hi"' },
      { name: "line\nbreak", qty: 2, note: "ok" },
    ];
    const csv = toCsv(rows, cols);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain('"line\nbreak"');
  });
});
