import "server-only";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/node";
import { LIMITS } from "./constants";
import { cleanText, isValidEmail, normalizeEmail, normalizeMatric } from "./utils";
import { getScholarFileTypeError } from "./scholar-file";

export const REQUIRED_COLUMNS = ["Full Name", "Matric Number", "Email"] as const;

type Field = "fullName" | "matric" | "email";

const HEADER_ALIASES: Record<Field, string[]> = {
  fullName: ["fullname", "name", "names", "fullnames", "scholarname", "studentname", "nameofscholar"],
  matric: [
    "matricnumber",
    "matricno",
    "matric",
    "matricnum",
    "matricnumbers",
    "matriculationnumber",
    "matriculationno",
  ],
  email: ["email", "emailaddress", "emails", "mail", "registeredemail", "registeredemailaddress", "emailaddresses"],
};

const FIELD_LABEL: Record<Field, string> = {
  fullName: "Full Name",
  matric: "Matric Number",
  email: "Email",
};

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapHeader(row: string[]): Partial<Record<Field, number>> {
  const mapping: Partial<Record<Field, number>> = {};
  row.forEach((cell, index) => {
    const key = headerKey(cell);
    for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
      if (mapping[field] === undefined && HEADER_ALIASES[field].includes(key)) mapping[field] = index;
    }
  });
  return mapping;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    // Matric numbers stored as numbers in Excel: avoid "2.0211262053e+10" style output.
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export type ImportRecord = {
  rowNumber: number;
  fullName: string;
  matricNumber: string;
  matricDisplay: string;
  email: string;
};

export type ImportIssue = { rowNumber: number; message: string };

export type ParsedImport = {
  sheetName: string | null;
  totalRows: number;
  records: ImportRecord[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export class ImportFileError extends Error {}

/** Reads a CSV or XLSX upload into a 2-D array of strings, choosing the sheet that has our columns. */
async function readTable(file: File): Promise<{ sheetName: string | null; rows: string[][] }> {
  const name = file.name.toLowerCase();
  if (file.size === 0) throw new ImportFileError("The file is empty.");
  if (file.size > LIMITS.uploadMaxBytes) throw new ImportFileError("The file is larger than 5 MB.");
  const typeError = getScholarFileTypeError(file.name);
  if (typeError) throw new ImportFileError(typeError);

  if (name.endsWith(".csv")) {
    const text = (await file.text()).replace(/^﻿/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    if (parsed.errors.length && !parsed.data.length) {
      throw new ImportFileError(`Could not read the CSV file: ${parsed.errors[0].message}`);
    }
    return { sheetName: null, rows: parsed.data.map((r) => r.map(cellToString)) };
  }

  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = await readXlsxFile(Buffer.from(await file.arrayBuffer()));
  } catch {
    throw new ImportFileError("Could not read the Excel file. Please re-save it as .xlsx or .csv.");
  }
  const asStrings = sheets.map((s) => ({
    sheetName: s.sheet,
    rows: s.data.map((r) => r.map(cellToString)),
  }));
  const withColumns = asStrings.find((s) => findHeaderRow(s.rows).complete);
  return withColumns ?? asStrings[0] ?? { sheetName: null, rows: [] };
}

function findHeaderRow(rows: string[][]) {
  let best = { index: -1, mapping: {} as Partial<Record<Field, number>>, count: 0 };
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const mapping = mapHeader(rows[i]);
    const count = Object.keys(mapping).length;
    if (count > best.count) best = { index: i, mapping, count };
    if (count === 3) break;
  }
  return { ...best, complete: best.count === 3 };
}

export async function parseScholarFile(file: File): Promise<ParsedImport> {
  const { sheetName, rows } = await readTable(file);
  if (!rows.length) throw new ImportFileError("No rows were found in the file.");

  const header = findHeaderRow(rows);
  if (!header.complete) {
    const missing = (Object.keys(FIELD_LABEL) as Field[])
      .filter((f) => header.mapping[f] === undefined)
      .map((f) => FIELD_LABEL[f]);
    throw new ImportFileError(
      `The file must have these columns: ${REQUIRED_COLUMNS.join(", ")}. Missing: ${missing.join(", ")}.`,
    );
  }

  const { fullName: nameCol, matric: matricCol, email: emailCol } = header.mapping as Record<Field, number>;
  const records: ImportRecord[] = [];
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const seenMatric = new Map<string, number>();
  const seenEmail = new Map<string, number>();
  let totalRows = 0;

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1; // 1-based, as shown in Excel
    const rawName = row[nameCol] ?? "";
    const rawMatric = row[matricCol] ?? "";
    const rawEmail = row[emailCol] ?? "";
    if (!cleanText(rawName) && !cleanText(rawMatric) && !cleanText(rawEmail)) continue; // blank row
    totalRows++;

    const fullName = cleanText(rawName);
    const matricDisplay = cleanText(rawMatric);
    const matricNumber = normalizeMatric(rawMatric);
    const email = normalizeEmail(rawEmail);
    const problems: string[] = [];

    if (!fullName) problems.push("Full Name is empty");
    else if (fullName.length > LIMITS.nameMax) problems.push(`Full Name is longer than ${LIMITS.nameMax} characters`);
    if (!matricNumber) problems.push("Matric Number is empty");
    else if (matricNumber.length > LIMITS.matricMax) problems.push("Matric Number is too long");
    else if (!/[A-Z0-9]/.test(matricNumber)) problems.push("Matric Number has no letters or digits");
    if (!email) problems.push("Email is empty");
    else if (!isValidEmail(email)) problems.push(`"${cleanText(rawEmail)}" is not a valid email`);

    if (matricNumber && seenMatric.has(matricNumber)) {
      problems.push(`Matric Number ${matricDisplay} is repeated (first seen on row ${seenMatric.get(matricNumber)})`);
    }

    if (problems.length) {
      errors.push({ rowNumber, message: problems.join("; ") });
      continue;
    }

    seenMatric.set(matricNumber, rowNumber);
    if (seenEmail.has(email)) {
      warnings.push({
        rowNumber,
        message: `Email ${email} is also used on row ${seenEmail.get(email)} — both scholars will receive codes at the same address`,
      });
    } else {
      seenEmail.set(email, rowNumber);
    }
    records.push({ rowNumber, fullName, matricNumber, matricDisplay, email });
  }

  if (!totalRows) throw new ImportFileError("The file has headers but no scholar rows.");
  return { sheetName, totalRows, records, errors, warnings };
}
