import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "./pool.js";

const dataDirectory = fileURLToPath(new URL("../../data/", import.meta.url));

const GSTIN_HEADERS = [
  "gstin",
  "legal_name",
  "trade_name",
  "constitution",
  "principal_place_of_business",
  "state",
  "registration_date",
  "status",
] as const;

const UDYAM_HEADERS = [
  "udyam_number",
  "enterprise_name",
  "enterprise_type",
  "major_activity",
  "nic_description",
  "state",
  "city",
  "date_of_registration",
] as const;

const BATCH_SIZE = 500;

interface GstinRecord {
  gstin: string;
  legalName: string;
  tradeName: string;
  constitution: string;
  principalPlaceOfBusiness: string;
  state: string;
  registrationDate: string;
  status: string;
}

interface UdyamRecord {
  udyamNumber: string;
  enterpriseName: string;
  enterpriseType: string;
  majorActivity: string;
  nicDescription: string;
  state: string;
  city: string;
  dateOfRegistration: string;
}

function parseCsv(contents: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;
  const input = contents.replace(/^\uFEFF/, "");

  while (index < input.length) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }

        inQuotes = false;
        index += 1;
        continue;
      }

      field += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }

    if (character === "\r" || character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";

      if (character === "\r" && input[index + 1] === "\n") {
        index += 2;
      } else {
        index += 1;
      }

      continue;
    }

    field += character;
    index += 1;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((parsedRow) =>
    parsedRow.some((cell) => cell.trim().length > 0),
  );
}

async function loadCsv<T>(
  fileName: string,
  expectedHeaders: readonly string[],
  mapRow: (row: Record<string, string>, lineNumber: number) => T,
): Promise<T[]> {
  const contents = await readFile(`${dataDirectory}${fileName}`, "utf8");
  const parsed = parseCsv(contents);

  if (parsed.length === 0) {
    throw new Error(`${fileName} is empty`);
  }

  const headers = parsed[0].map((header) => header.trim());

  if (
    headers.length !== expectedHeaders.length ||
    expectedHeaders.some((header, index) => headers[index] !== header)
  ) {
    throw new Error(
      `${fileName} has unexpected headers. Expected: ${expectedHeaders.join(", ")}`,
    );
  }

  return parsed.slice(1).map((row, index) => {
    if (row.length !== expectedHeaders.length) {
      throw new Error(
        `${fileName} line ${index + 2} has ${row.length} columns, expected ${expectedHeaders.length}`,
      );
    }

    const record = Object.fromEntries(
      expectedHeaders.map((header, columnIndex) => [
        header,
        row[columnIndex]?.trim() ?? "",
      ]),
    );

    return mapRow(record, index + 2);
  });
}

function required(
  record: Record<string, string>,
  key: string,
  fileName: string,
  lineNumber: number,
): string {
  const value = record[key];

  if (!value) {
    throw new Error(`${fileName} line ${lineNumber} is missing ${key}`);
  }

  return value;
}

function isoDate(
  record: Record<string, string>,
  key: string,
  fileName: string,
  lineNumber: number,
): string {
  const value = required(record, key, fileName, lineNumber);
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(
      `${fileName} line ${lineNumber} has an invalid ${key}: ${value}`,
    );
  }

  return value;
}

async function loadGstinRecords(): Promise<GstinRecord[]> {
  const fileName = "mock_gstin_registry.csv";

  return loadCsv(fileName, GSTIN_HEADERS, (record, lineNumber) => ({
    gstin: required(record, "gstin", fileName, lineNumber),
    legalName: required(record, "legal_name", fileName, lineNumber),
    tradeName: required(record, "trade_name", fileName, lineNumber),
    constitution: required(record, "constitution", fileName, lineNumber),
    principalPlaceOfBusiness: required(
      record,
      "principal_place_of_business",
      fileName,
      lineNumber,
    ),
    state: required(record, "state", fileName, lineNumber),
    registrationDate: isoDate(
      record,
      "registration_date",
      fileName,
      lineNumber,
    ),
    status: required(record, "status", fileName, lineNumber),
  }));
}

async function loadUdyamRecords(): Promise<UdyamRecord[]> {
  const fileName = "mock_udyam_registry.csv";

  return loadCsv(fileName, UDYAM_HEADERS, (record, lineNumber) => ({
    udyamNumber: required(record, "udyam_number", fileName, lineNumber),
    enterpriseName: required(record, "enterprise_name", fileName, lineNumber),
    enterpriseType: required(record, "enterprise_type", fileName, lineNumber),
    majorActivity: required(record, "major_activity", fileName, lineNumber),
    nicDescription: required(record, "nic_description", fileName, lineNumber),
    state: required(record, "state", fileName, lineNumber),
    city: required(record, "city", fileName, lineNumber),
    dateOfRegistration: isoDate(
      record,
      "date_of_registration",
      fileName,
      lineNumber,
    ),
  }));
}

async function upsertRows(
  client: PoolClient,
  table: string,
  columns: string[],
  conflictColumn: string,
  rows: unknown[][],
): Promise<void> {
  const updates = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const values: unknown[] = [];

    const placeholders = batch.map((row, rowIndex) => {
      if (row.length !== columns.length) {
        throw new Error(`Row has ${row.length} values, expected ${columns.length}`);
      }

      const offset = rowIndex * columns.length;
      values.push(...row);

      return `(${row
        .map((_, columnIndex) => `$${offset + columnIndex + 1}`)
        .join(", ")})`;
    });

    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")})
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates}`,
      values,
    );
  }
}

async function main(): Promise<void> {
  const [gstinRecords, udyamRecords] = await Promise.all([
    loadGstinRecords(),
    loadUdyamRecords(),
  ]);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await upsertRows(
      client,
      "mock_gstin_registry",
      [
        "gstin",
        "legal_name",
        "trade_name",
        "constitution",
        "principal_place_of_business",
        "state",
        "registration_date",
        "status",
      ],
      "gstin",
      gstinRecords.map((record) => [
        record.gstin,
        record.legalName,
        record.tradeName,
        record.constitution,
        record.principalPlaceOfBusiness,
        record.state,
        record.registrationDate,
        record.status,
      ]),
    );

    await upsertRows(
      client,
      "mock_udyam_registry",
      [
        "udyam_number",
        "enterprise_name",
        "enterprise_type",
        "major_activity",
        "nic_description",
        "state",
        "city",
        "date_of_registration",
      ],
      "udyam_number",
      udyamRecords.map((record) => [
        record.udyamNumber,
        record.enterpriseName,
        record.enterpriseType,
        record.majorActivity,
        record.nicDescription,
        record.state,
        record.city,
        record.dateOfRegistration,
      ]),
    );

    await client.query("COMMIT");

    console.log(
      `Loaded ${gstinRecords.length} GSTIN records and ${udyamRecords.length} Udyam records`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Mock registry seed failed", error);
    await pool.end();
    process.exitCode = 1;
  });
