import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import { ApiError } from "../utils/ApiError.js";
import { kycService } from "./kyc.service.js";
import { extractText, type OcrInput, type OcrResult } from "./ocr.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MATCH_THRESHOLD = 0.7;
const ADDRESS_MATCH_THRESHOLD = 0.6;
const MIN_TEXT_LENGTH = 20;
const MIN_CONFIDENCE = 20;
const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const DIGIT_CONFUSIONS: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  A: "4",
  S: "5",
  G: "6",
  T: "7",
  B: "8",
  P: "9",
};
const LETTER_CONFUSIONS: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "4": "A",
  "5": "S",
  "6": "G",
  "7": "T",
  "8": "B",
  "9": "P",
};

const REQUIRED_CONSENT_CATEGORIES = [
  "gst_certificate",
  "udyam_certificate",
  "signatory_id",
  "address_proof",
] as const;

export interface KycDocuments {
  gstCertificate: OcrInput;
  udyamCertificate: OcrInput;
  signatoryId: OcrInput;
  addressProof: OcrInput;
}

export type KycVerificationStatus = "verified" | "manual_review";

export interface KycCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string | null;
}

interface ExtractedGst {
  gstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  address: string | null;
  status: string | null;
}

interface ExtractedUdyam {
  udyamNumber: string | null;
  enterpriseName: string | null;
  enterpriseType: string | null;
  majorActivity: string | null;
  state: string | null;
  city: string | null;
}

interface ExtractedSignatory {
  idType: "mock" | null;
  idMasked: string | null;
  name: string | null;
}

interface ExtractedAddressProof {
  name: string | null;
  address: string | null;
}

interface OcrMetadata {
  confidence: number;
  pages: number;
  readable: boolean;
}

export interface ExtractedKycData {
  gst: ExtractedGst;
  udyam: ExtractedUdyam;
  signatory: ExtractedSignatory;
  addressProof: ExtractedAddressProof;
  ocr: Record<keyof KycDocuments, OcrMetadata>;
}

export interface KycVerification {
  id: string;
  status: KycVerificationStatus;
  checks: KycCheck[];
  extracted: ExtractedKycData;
  createdAt: string;
}

interface GstRegistryRow {
  gstin: string;
  legal_name: string;
  trade_name: string;
  constitution: string;
  principal_place_of_business: string;
  state: string;
  registration_date: Date;
  status: string;
}

interface UdyamRegistryRow {
  udyam_number: string;
  enterprise_name: string;
  enterprise_type: string;
  major_activity: string;
  nic_description: string;
  state: string;
  city: string;
  date_of_registration: Date;
}

interface VerificationRow {
  id: string;
  status: KycVerificationStatus;
  checks: KycCheck[];
  extracted_data: ExtractedKycData;
  created_at: Date;
}

function cleanLine(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanValue(value: string): string {
  return cleanLine(value)
    .replace(/^[:\-–—.\s]+/, "")
    .replace(/[:\-–—.\s]+$/, "")
    .trim();
}

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelPattern(label: string): string {
  return label
    .split(/\s+/)
    .map((part) => escapeRegExp(part))
    .join("\\s*");
}

function isDigit(value: string): boolean {
  return value >= "0" && value <= "9";
}

function isLetter(value: string): boolean {
  return value >= "A" && value <= "Z";
}

function normalizeFixed(
  value: string,
  type: "letters" | "digits",
): string | null {
  let normalized = "";

  for (const char of value) {
    const valid = type === "digits" ? isDigit(char) : isLetter(char);

    if (valid) {
      normalized += char;
      continue;
    }

    const replacement =
      type === "digits" ? DIGIT_CONFUSIONS[char] : LETTER_CONFUSIONS[char];

    if (!replacement) {
      return null;
    }

    normalized += replacement;
  }

  return normalized;
}

function normalizeGstinWindow(value: string): string | null {
  if (value.length !== 15) {
    return null;
  }

  let candidate = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (index === 13) {
      const entityCode =
        char === "Z" || char === "2" || char === "7" ? "Z" : char;

      if (entityCode !== "Z") {
        return null;
      }

      candidate += entityCode;
      continue;
    }

    if (index <= 1 || (index >= 7 && index <= 10)) {
      if (isDigit(char)) {
        candidate += char;
        continue;
      }

      const replacement = DIGIT_CONFUSIONS[char];

      if (!replacement) {
        return null;
      }

      candidate += replacement;
      continue;
    }

    if ((index >= 2 && index <= 6) || index === 11) {
      if (isLetter(char)) {
        candidate += char;
        continue;
      }

      const replacement = LETTER_CONFUSIONS[char];

      if (!replacement) {
        return null;
      }

      candidate += replacement;
      continue;
    }

    candidate += char;
  }

  return GSTIN_PATTERN.test(candidate) ? candidate : null;
}

function isValidGstinChecksum(gstin: string): boolean {
  let sum = 0;

  for (let index = 0; index < 14; index += 1) {
    const value = GSTIN_ALPHABET.indexOf(gstin[index]);

    if (value < 0) {
      return false;
    }

    const factor = index % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }

  const checkCharacter = GSTIN_ALPHABET[(36 - (sum % 36)) % 36];

  return checkCharacter === gstin[14];
}

function extractGstinCandidates(text: string): string[] {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const scores = new Map<string, number>();

  for (let start = 0; start <= compact.length - 15; start += 1) {
    const candidate = normalizeGstinWindow(compact.slice(start, start + 15));

    if (!candidate) {
      continue;
    }

    let score = 0;
    const before = compact.slice(Math.max(0, start - 18), start);

    if (isValidGstinChecksum(candidate)) {
      score += 4;
    }

    if (/(?:GSTIN(?:UIN|NO|NUMBER)?|GSTN(?:UMBER|O)?)$/.test(before)) {
      score += 6;
    } else if (/GST/.test(before)) {
      score += 2;
    }

    const stateCode = Number(candidate.slice(0, 2));

    if (
      (stateCode >= 1 && stateCode <= 38) ||
      stateCode === 97 ||
      stateCode === 99
    ) {
      score += 1;
    }

    scores.set(candidate, Math.max(scores.get(candidate) ?? 0, score));
  }

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([candidate]) => candidate);
}

function extractGstinSearchTokens(text: string): string[] {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const tokens = new Set<string>();
  const labelPattern = /GSTIN(?:UIN|NO|NUMBER)?|GSTN(?:UMBER|O)?/g;

  for (const match of compact.matchAll(labelPattern)) {
    const matchIndex = match.index ?? 0;
    const afterLabel = compact.slice(matchIndex + match[0].length);
    const stopIndex = afterLabel.search(
      /LEGAL|TRADE|NAME|ADDRESS|CONSTITUTION|DATE|STATUS|TYPE|PLACE|PROPRIETOR|BUSINESS|REGISTRATION/,
    );
    const token = (
      stopIndex >= 0 ? afterLabel.slice(0, stopIndex) : afterLabel.slice(0, 20)
    ).replace(/[^A-Z0-9]/g, "");

    if (token.length >= 12 && token.length <= 18) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

function extractGstin(text: string): string | null {
  return extractGstinCandidates(text)[0] ?? null;
}

function extractUdyamCandidates(text: string): string[] {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const scores = new Map<string, number>();
  const prefixPattern = /U[D0O]Y[A4][MN]/g;

  for (const match of compact.matchAll(prefixPattern)) {
    const matchIndex = match.index ?? 0;
    const start = matchIndex + match[0].length;
    const state = normalizeFixed(compact.slice(start, start + 2), "letters");
    const category = normalizeFixed(
      compact.slice(start + 2, start + 4),
      "digits",
    );
    const registration = normalizeFixed(
      compact.slice(start + 4, start + 11),
      "digits",
    );

    if (
      !state ||
      state.length !== 2 ||
      !category ||
      category.length !== 2 ||
      !registration ||
      registration.length !== 7
    ) {
      continue;
    }

    const candidate = `UDYAM-${state}-${category}-${registration}`;
    const before = compact.slice(Math.max(0, matchIndex - 18), matchIndex);
    let score = match[0] === "UDYAM" ? 4 : 2;

    if (/UDYAM(?:REGISTRATION)?(?:NUMBER|NO)?$/.test(before)) {
      score += 2;
    }

    scores.set(candidate, Math.max(scores.get(candidate) ?? 0, score));
  }

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([candidate]) => candidate);
}

function extractUdyamNumber(text: string): string | null {
  return extractUdyamCandidates(text)[0] ?? null;
}

function isStopLine(value: string): boolean {
  return /^(gstin|gst|trade name|legal name|constitution|date|status|address|supply address|principal place of business|place of business|udyam|registration|enterprise|enterprise type|major activity|name of|type|state|district|city|pin|pincode|mobile|phone|email|pan|aadhaar|dob|date of birth|signature|photograph|bill|billed|consumer|units|amount|valid till|designation|for business|id no|id number|signatory)\b/i.test(
    value,
  );
}

function joinLabelParts(parts: string[]): string {
  let result = parts[0] ?? "";

  for (let index = 1; index < parts.length; index += 1) {
    const next = parts[index];

    if (/[,;:]$/.test(result)) {
      result = `${result} ${next}`;
    } else if (/[A-Za-z]$/.test(result) && /^[a-z]/.test(next)) {
      result = `${result}${next}`;
    } else {
      result = `${result}, ${next}`;
    }
  }

  return result;
}

function extractLabeledValue(
  lines: string[],
  labels: string[],
  options: {
    maxFollowingLines?: number;
    rejectValue?: (value: string) => boolean;
  } = {},
): string | null {
  const sortedLabels = [...labels].sort((a, b) => b.length - a.length);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const label of sortedLabels) {
      const matcher = new RegExp(
        `^[•*\\-–—]?\\s*${labelPattern(label)}\\s*[:\\-–—]?\\s*(.*)$`,
        "i",
      );
      const match = line.match(matcher);

      if (!match) {
        continue;
      }

      const inlineValue = cleanValue(match[1]);

      if (inlineValue && options.rejectValue?.(inlineValue)) {
        continue;
      }

      const parts: string[] = [];

      if (inlineValue) {
        parts.push(inlineValue);
      }

      const maxFollowingLines = options.maxFollowingLines ?? 0;

      for (
        let following = index + 1;
        following < lines.length && following <= index + maxFollowingLines;
        following += 1
      ) {
        const next = cleanValue(lines[following]);

        if (!next || isStopLine(next)) {
          break;
        }

        if (!options.rejectValue?.(next)) {
          parts.push(next);
        }
      }

      if (parts.length > 0) {
        return joinLabelParts(parts);
      }
    }
  }

  return null;
}

function extractMockId(text: string): string | null {
  const lines = linesOf(text);
  const value = extractLabeledValue(
    lines,
    [
      "Signatory ID no.",
      "Signatory ID no",
      "Signatory ID",
      "ID number",
      "ID No.",
      "ID No",
      "ID no.",
      "ID no",
    ],
    { maxFollowingLines: 1 },
  );

  if (!value) {
    return null;
  }

  const id = value.replace(/\s+/g, " ").trim();

  return id.length >= 3 ? id : null;
}

function extractGst(
  text: string,
  gstin: string | null = extractGstin(text),
): ExtractedGst {
  const lines = linesOf(text);

  return {
    gstin,
    legalName: extractLabeledValue(lines, [
      "Legal Name",
      "Legal Name of Business",
      "Legal Name of Registered Person",
      "Name of Registered Person",
      "Registered Name",
      "Name of Business",
      "Name of the Business",
    ]),
    tradeName: extractLabeledValue(lines, [
      "Trade Name",
      "Trade Name, if any",
      "Trade Name (If Any)",
      "Trade Name if Any",
      "Business Name",
    ]),
    address: extractLabeledValue(
      lines,
      [
        "Principal Place of Business",
        "Principal Place of Business Address",
        "Address of Principal Place of Business",
        "Place of Business",
        "Registered Address",
        "Address",
      ],
      { maxFollowingLines: 4 },
    ),
    status: /cancell?ed|inactive|suspended/i.test(text)
      ? "Cancelled"
      : /\bactive\b/i.test(text)
        ? "Active"
        : null,
  };
}

function extractUdyam(
  text: string,
  udyamNumber: string | null = extractUdyamNumber(text),
): ExtractedUdyam {
  const lines = linesOf(text);
  const typeMatch = text.match(/\b(Micro|Small|Medium)\b/i);
  const activityMatch = text.match(/\b(Manufacturing|Service|Services|Trading)\b/i);

  return {
    udyamNumber,
    enterpriseName: extractLabeledValue(lines, [
      "Name of Enterprise",
      "Enterprise Name",
      "Name of the Enterprise",
      "Name of Unit",
      "Name of Business",
    ]),
    enterpriseType:
      extractLabeledValue(lines, [
        "Enterprise Type",
        "Type of Enterprise",
        "Type of Unit",
      ]) ??
      (typeMatch
        ? typeMatch[1].charAt(0).toUpperCase() +
          typeMatch[1].slice(1).toLowerCase()
        : null),
    majorActivity:
      extractLabeledValue(lines, ["Major Activity", "Activity"]) ??
      (activityMatch
        ? activityMatch[1].charAt(0).toUpperCase() +
          activityMatch[1].slice(1).toLowerCase()
        : null),
    state: extractLabeledValue(lines, ["State", "State Name"]),
    city: extractLabeledValue(lines, [
      "City",
      "District",
      "District Name",
      "Town",
    ]),
  };
}

function rejectRelationshipName(value: string): boolean {
  return /^(of|father|mother|spouse|husband|wife|guardian)\b/i.test(value);
}

function fallbackPersonName(lines: string[]): string | null {
  const blocked =
    /government|india|income tax|department|permanent account|aadhaar|pan|card|signature|date|birth|male|female|gender|address|father|mother|spouse|husband|wife|authority|unique identification/i;

  for (const line of lines) {
    const value = cleanValue(line);

    if (blocked.test(value)) {
      continue;
    }

    const words = value.split(/\s+/);

    if (
      words.length >= 2 &&
      words.length <= 5 &&
      words.every((word) => /^[A-Za-z][A-Za-z.'-]{1,}$/.test(word))
    ) {
      return value;
    }
  }

  return null;
}

function extractSignatory(text: string): ExtractedSignatory {
  const lines = linesOf(text);
  const id = extractMockId(text);
  const name =
    extractLabeledValue(
      lines,
      [
        "Name",
        "Name of Card Holder",
        "Cardholder Name",
        "Name of Holder",
        "Holder Name",
        "Applicant Name",
        "Name of Applicant",
      ],
      { rejectValue: rejectRelationshipName },
    ) ?? fallbackPersonName(lines);

  return {
    idType: id ? "mock" : null,
    idMasked: id,
    name,
  };
}

function extractAddressProof(text: string): ExtractedAddressProof {
  const lines = linesOf(text);

  return {
    name:
      extractLabeledValue(
        lines,
        [
          "Name",
          "Consumer Name",
          "Customer Name",
          "Account Holder Name",
          "Owner Name",
          "Tenant Name",
          "Applicant Name",
          "Billing Name",
          "Billed To",
          "Billed to",
        ],
        { rejectValue: rejectRelationshipName },
      ) ?? fallbackPersonName(lines),
    address: extractLabeledValue(
      lines,
      [
        "Address",
        "Billing Address",
        "Property Address",
        "Residential Address",
        "Premises Address",
        "Installation Address",
        "Service Address",
        "Supply Address",
        "Supply Address of Business",
        "Consumer Address",
        "Billed Address",
      ],
      { maxFollowingLines: 4 },
    ),
  };
}

function nameTokens(value: string): Set<string> {
  const suffixes = new Set([
    "pvt",
    "private",
    "ltd",
    "limited",
    "llp",
    "co",
    "company",
    "the",
    "and",
    "m",
    "s",
    "ms",
    "prop",
    "proprietor",
    "proprietorship",
  ]);

  return new Set(
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && !suffixes.has(token)),
  );
}

function addressTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  );
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + cost,
      );
      diagonal = above;
    }
  }

  return previous[right.length];
}

function similarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const containment = intersection / Math.min(left.size, right.size);
  const union = left.size + right.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;

  return Math.max(containment, jaccard);
}

function bestNameSimilarity(
  value: string | null,
  candidates: Array<string | null>,
): number {
  if (!value) {
    return 0;
  }

  const tokens = nameTokens(value);

  return candidates.reduce(
    (best, candidate) =>
      candidate ? Math.max(best, similarity(tokens, nameTokens(candidate))) : best,
    0,
  );
}

function bestAddressSimilarity(
  value: string | null,
  candidates: Array<string | null>,
): number {
  if (!value) {
    return 0;
  }

  const tokens = addressTokens(value);

  return candidates.reduce(
    (best, candidate) =>
      candidate
        ? Math.max(best, similarity(tokens, addressTokens(candidate)))
        : best,
    0,
  );
}

function check(
  key: string,
  label: string,
  passed: boolean,
  detail: string | null = null,
): KycCheck {
  return { key, label, passed, detail };
}

async function findGstRecord(
  gstinCandidates: string[],
): Promise<GstRegistryRow | null> {
  const candidates = [...new Set(gstinCandidates)].slice(0, 25);

  if (candidates.length === 0) {
    return null;
  }

  const result = await query<GstRegistryRow>(
    `SELECT gstin, legal_name, trade_name, constitution,
            principal_place_of_business, state, registration_date, status
     FROM mock_gstin_registry
     WHERE gstin = ANY($1::text[])`,
    [candidates],
  );
  const byGstin = new Map(result.rows.map((row) => [row.gstin, row]));

  for (const candidate of candidates) {
    const row = byGstin.get(candidate);

    if (row) {
      return row;
    }
  }

  return null;
}

async function findFuzzyGstRecord(
  searchTokens: string[],
  name: string | null,
  address: string | null,
): Promise<GstRegistryRow | null> {
  const tokens = [...new Set(searchTokens)].filter(
    (token) => token.length >= 12 && token.length <= 18,
  );

  if (!name || tokens.length === 0) {
    return null;
  }

  const result = await query<GstRegistryRow>(
    `SELECT gstin, legal_name, trade_name, constitution,
            principal_place_of_business, state, registration_date, status
     FROM mock_gstin_registry`,
  );
  const matches: Array<{ row: GstRegistryRow; score: number }> = [];

  for (const row of result.rows) {
    const nameSimilarity = bestNameSimilarity(name, [
      row.legal_name,
      row.trade_name,
    ]);

    if (nameSimilarity < NAME_MATCH_THRESHOLD) {
      continue;
    }

    const addressSimilarity = address
      ? bestAddressSimilarity(address, [row.principal_place_of_business])
      : 0;

    if (
      address &&
      addressSimilarity < ADDRESS_MATCH_THRESHOLD &&
      nameSimilarity < 0.85
    ) {
      continue;
    }

    let distance = Number.POSITIVE_INFINITY;

    for (const token of tokens) {
      distance = Math.min(distance, levenshtein(token, row.gstin));
    }

    if (distance > 5) {
      continue;
    }

    const stateMatches = tokens.some(
      (token) => token.slice(0, 2) === row.gstin.slice(0, 2),
    );

    if (!stateMatches) {
      continue;
    }

    matches.push({
      row,
      score:
        nameSimilarity * 4 +
        addressSimilarity * 2 +
        (5 - distance) * 0.4,
    });
  }

  matches.sort((left, right) => right.score - left.score);

  const best = matches[0];

  if (!best) {
    return null;
  }

  const second = matches[1];

  if (second && best.score - second.score < 0.25) {
    return null;
  }

  return best.row;
}

async function findUdyamRecord(
  udyamCandidates: string[],
): Promise<UdyamRegistryRow | null> {
  const candidates = [...new Set(udyamCandidates)].slice(0, 25);

  if (candidates.length === 0) {
    return null;
  }

  const result = await query<UdyamRegistryRow>(
    `SELECT udyam_number, enterprise_name, enterprise_type, major_activity,
            nic_description, state, city, date_of_registration
     FROM mock_udyam_registry
     WHERE udyam_number = ANY($1::text[])`,
    [candidates],
  );
  const byUdyam = new Map(
    result.rows.map((row) => [row.udyam_number, row]),
  );

  for (const candidate of candidates) {
    const row = byUdyam.get(candidate);

    if (row) {
      return row;
    }
  }

  return null;
}

async function runOcr(
  input: OcrInput,
): Promise<{ result: OcrResult | null; error: unknown | null }> {
  try {
    return { result: await extractText(input), error: null };
  } catch (error) {
    return { result: null, error };
  }
}

function ocrMetadata(result: OcrResult | null): OcrMetadata {
  return {
    confidence: result ? Math.round(result.confidence) : 0,
    pages: result?.pages ?? 0,
    readable:
      result !== null &&
      result.text.trim().length >= MIN_TEXT_LENGTH &&
      result.confidence >= MIN_CONFIDENCE,
  };
}

function logOcrText(name: string, result: OcrResult): void {
  if (env.isProduction) {
    return;
  }

  console.log(
    `[dev-only raw OCR text] ${name} (confidence=${Math.round(result.confidence)}, pages=${result.pages})\n${result.text.trim()}\n---`,
  );
}

function logExtractedFields(fields: {
  gstCertificate: ExtractedGst;
  udyamCertificate: ExtractedUdyam;
  signatoryId: ExtractedSignatory;
  addressProof: ExtractedAddressProof;
}): void {
  if (env.isProduction) {
    return;
  }

  console.log(
    "[dev-only extracted KYC fields]",
    JSON.stringify(fields, null, 2),
  );
}

function toVerification(row: VerificationRow): KycVerification {
  return {
    id: row.id,
    status: row.status,
    checks: row.checks,
    extracted: row.extracted_data,
    createdAt: row.created_at.toISOString(),
  };
}

export const kycVerificationService = {
  async verifyDocuments(
    userId: string,
    documents: KycDocuments,
  ): Promise<KycVerification> {
    const consent = await kycService.getLatestConsent(userId);

    if (!consent || consent.status !== "active") {
      throw new ApiError(
        403,
        "Active KYC consent is required before documents can be verified",
      );
    }

    const missingCategories = REQUIRED_CONSENT_CATEGORIES.filter(
      (category) => !consent.dataCategories.includes(category),
    );

    if (missingCategories.length > 0) {
      throw new ApiError(
        403,
        "Your consent does not cover all required KYC documents",
      );
    }

    const [gstOcr, udyamOcr, signatoryOcr, addressOcr] = await Promise.all([
      runOcr(documents.gstCertificate),
      runOcr(documents.udyamCertificate),
      runOcr(documents.signatoryId),
      runOcr(documents.addressProof),
    ]);

    const ocrOutcomes = {
      gstCertificate: gstOcr,
      udyamCertificate: udyamOcr,
      signatoryId: signatoryOcr,
      addressProof: addressOcr,
    };

    for (const [name, outcome] of Object.entries(ocrOutcomes)) {
      if (outcome.error) {
        console.warn(`OCR failed for ${name}`, outcome.error);
      }

      if (outcome.result) {
        logOcrText(name, outcome.result);
      }
    }

    const gstText = gstOcr.result?.text ?? "";
    const udyamText = udyamOcr.result?.text ?? "";
    const signatoryText = signatoryOcr.result?.text ?? "";
    const addressText = addressOcr.result?.text ?? "";

    const gstinCandidates = extractGstinCandidates(gstText);
    const gstinSearchTokens = extractGstinSearchTokens(gstText);
    const udyamCandidates = extractUdyamCandidates(udyamText);
    const gst = extractGst(gstText, gstinCandidates[0] ?? null);
    const udyam = extractUdyam(udyamText, udyamCandidates[0] ?? null);
    const signatory = extractSignatory(signatoryText);
    const addressProof = extractAddressProof(addressText);

    const [exactGstRecord, udyamRecord] = await Promise.all([
      findGstRecord(gstinCandidates),
      findUdyamRecord(udyamCandidates),
    ]);
    const gstRecord =
      exactGstRecord ??
      (await findFuzzyGstRecord(
        [...gstinSearchTokens, ...gstinCandidates],
        gst.legalName ?? gst.tradeName,
        gst.address,
      ));
    const gstinRecovered = exactGstRecord === null && gstRecord !== null;

    if (gstRecord) {
      gst.gstin = gstRecord.gstin;
    }

    if (udyamRecord) {
      udyam.udyamNumber = udyamRecord.udyam_number;
    }

    logExtractedFields({
      gstCertificate: gst,
      udyamCertificate: udyam,
      signatoryId: signatory,
      addressProof,
    });

    const businessNames = [
      gstRecord?.legal_name ?? null,
      gstRecord?.trade_name ?? null,
      udyamRecord?.enterprise_name ?? null,
    ];

    const gstNameSimilarity = bestNameSimilarity(
      gst.legalName ?? gst.tradeName,
      [gstRecord?.legal_name ?? null, gstRecord?.trade_name ?? null],
    );
    const udyamNameSimilarity = bestNameSimilarity(udyam.enterpriseName, [
      udyamRecord?.enterprise_name ?? null,
    ]);
    const signatoryNameSimilarity = bestNameSimilarity(
      signatory.name,
      businessNames,
    );
    const addressNameSimilarity = bestNameSimilarity(addressProof.name, [
      ...businessNames,
      signatory.name,
    ]);
    const addressSimilarity = bestAddressSimilarity(addressProof.address, [
      gstRecord?.principal_place_of_business ?? null,
    ]);

    const ocr = {
      gstCertificate: ocrMetadata(gstOcr.result),
      udyamCertificate: ocrMetadata(udyamOcr.result),
      signatoryId: ocrMetadata(signatoryOcr.result),
      addressProof: ocrMetadata(addressOcr.result),
    };

    const checks: KycCheck[] = [
      check(
        "gst_document_read",
        "GST certificate could be read",
        ocr.gstCertificate.readable,
        ocr.gstCertificate.readable
          ? null
          : "The GST certificate could not be read clearly.",
      ),
      check(
        "gstin_extracted",
        "GSTIN was found",
        gst.gstin !== null,
        gst.gstin ? null : "The GSTIN could not be extracted.",
      ),
      check(
        "gstin_registry_match",
        "GSTIN matches the GST registry",
        gstRecord !== null,
        gstRecord ? null : "The GSTIN was not found in the GST registry.",
      ),
      ...(gstinRecovered && gstRecord
        ? [
            check(
              "gstin_ocr_correction",
              "GSTIN was matched after OCR correction",
              true,
              `Matched registry GSTIN ${gstRecord.gstin} from OCR reading ${gstinSearchTokens[0] ?? "unknown"}.`,
            ),
          ]
        : []),
      check(
        "gst_name_match",
        "GST business name matches the registry",
        gstNameSimilarity >= NAME_MATCH_THRESHOLD,
        gstRecord
          ? `Name similarity ${(gstNameSimilarity * 100).toFixed(0)}%; required ${(NAME_MATCH_THRESHOLD * 100).toFixed(0)}%.`
          : "The GST record is unavailable.",
      ),
      check(
        "gst_status_active",
        "GST registration is active",
        gstRecord?.status.toLowerCase() === "active",
        gstRecord ? `Registry status: ${gstRecord.status}.` : "The GST record is unavailable.",
      ),
      check(
        "udyam_document_read",
        "Udyam certificate could be read",
        ocr.udyamCertificate.readable,
        ocr.udyamCertificate.readable
          ? null
          : "The Udyam certificate could not be read clearly.",
      ),
      check(
        "udyam_number_extracted",
        "Udyam number was found",
        udyam.udyamNumber !== null,
        udyam.udyamNumber ? null : "The Udyam number could not be extracted.",
      ),
      check(
        "udyam_registry_match",
        "Udyam number matches the Udyam registry",
        udyamRecord !== null,
        udyamRecord
          ? null
          : "The Udyam number was not found in the Udyam registry.",
      ),
      check(
        "udyam_name_match",
        "Udyam enterprise name matches the registry",
        udyamNameSimilarity >= NAME_MATCH_THRESHOLD,
        udyamRecord
          ? `Name similarity ${(udyamNameSimilarity * 100).toFixed(0)}%; required ${(NAME_MATCH_THRESHOLD * 100).toFixed(0)}%.`
          : "The Udyam record is unavailable.",
      ),
      check(
        "signatory_document_read",
        "Signatory ID could be read",
        ocr.signatoryId.readable,
        ocr.signatoryId.readable
          ? null
          : "The signatory ID could not be read clearly.",
      ),
      check(
        "signatory_id_extracted",
        "Signatory ID number was found",
        signatory.idMasked !== null,
        signatory.idMasked
          ? `Signatory ID ending ${signatory.idMasked.slice(-4)}.`
          : "The signatory ID number could not be extracted.",
      ),
      check(
        "signatory_name_match",
        "Signatory name matches the registered business",
        signatoryNameSimilarity >= NAME_MATCH_THRESHOLD,
        signatory.name
          ? `Name similarity ${(signatoryNameSimilarity * 100).toFixed(0)}%; required ${(NAME_MATCH_THRESHOLD * 100).toFixed(0)}%.`
          : "The signatory name could not be extracted.",
      ),
      check(
        "address_document_read",
        "Address proof could be read",
        ocr.addressProof.readable,
        ocr.addressProof.readable
          ? null
          : "The address proof could not be read clearly.",
      ),
      check(
        "address_extracted",
        "Address was found in the address proof",
        addressProof.address !== null,
        addressProof.address ? null : "An address could not be extracted.",
      ),
      check(
        "address_name_match",
        "Address proof name matches the business or signatory",
        addressNameSimilarity >= NAME_MATCH_THRESHOLD,
        addressProof.name
          ? `Name similarity ${(addressNameSimilarity * 100).toFixed(0)}%; required ${(NAME_MATCH_THRESHOLD * 100).toFixed(0)}%.`
          : "The name on the address proof could not be extracted.",
      ),
      check(
        "address_match",
        "Address proof matches the registered business address",
        addressSimilarity >= ADDRESS_MATCH_THRESHOLD,
        gstRecord
          ? `Address similarity ${(addressSimilarity * 100).toFixed(0)}%; required ${(ADDRESS_MATCH_THRESHOLD * 100).toFixed(0)}%.`
          : "The GST record is unavailable.",
      ),
    ];

    const status: KycVerificationStatus = checks.every((item) => item.passed)
      ? "verified"
      : "manual_review";

    const extracted: ExtractedKycData = {
      gst,
      udyam,
      signatory,
      addressProof,
      ocr,
    };

    const result = await query<VerificationRow>(
      `INSERT INTO kyc_verifications (
        id,
        user_id,
        consent_id,
        status,
        checks,
        extracted_data
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      RETURNING id, status, checks, extracted_data, created_at`,
      [
        randomUUID(),
        userId,
        consent.id,
        status,
        JSON.stringify(checks),
        JSON.stringify(extracted),
      ],
    );

    return toVerification(result.rows[0]);
  },

  async getVerification(
    userId: string,
    verificationId: string,
  ): Promise<KycVerification> {
    if (!UUID_PATTERN.test(verificationId)) {
      throw new ApiError(404, "Verification not found");
    }

    const result = await query<VerificationRow>(
      `SELECT id, status, checks, extracted_data, created_at
       FROM kyc_verifications
       WHERE id = $1 AND user_id = $2`,
      [verificationId, userId],
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Verification not found");
    }

    return toVerification(result.rows[0]);
  },
};
