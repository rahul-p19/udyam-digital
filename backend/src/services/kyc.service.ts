import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import { ApiError } from "../utils/ApiError.js";

export const KYC_CONSENT_VERSION = "1.0";

export const KYC_DATA_CATEGORIES = [
  "gst_certificate",
  "udyam_certificate",
  "signatory_id",
  "address_proof",
] as const;

export const KYC_PURPOSES = [
  "identity_verification",
  "regulatory_compliance",
  "fraud_prevention",
] as const;

export type KycDataCategory = (typeof KYC_DATA_CATEGORIES)[number];
export type KycPurpose = (typeof KYC_PURPOSES)[number];

export interface KycConsentInput {
  consentVersion?: unknown;
  dataCategories?: unknown;
  purposes?: unknown;
  accepted?: unknown;
  authorizedSignatory?: unknown;
}

interface KycConsentRow {
  id: string;
  user_id: string;
  entity_type: string;
  consent_version: string;
  data_categories: string[];
  purposes: string[];
  authorized_signatory: boolean;
  status: "active" | "withdrawn";
  accepted_at: Date;
  withdrawn_at: Date | null;
  created_at: Date;
}

export interface KycConsent {
  id: string;
  entityType: string;
  consentVersion: string;
  dataCategories: string[];
  purposes: string[];
  authorizedSignatory: boolean;
  status: "active" | "withdrawn";
  acceptedAt: string;
  withdrawnAt: string | null;
}

const consentColumns = `
  id,
  user_id,
  entity_type,
  consent_version,
  data_categories,
  purposes,
  authorized_signatory,
  status,
  accepted_at,
  withdrawn_at,
  created_at
`;

function toConsent(row: KycConsentRow): KycConsent {
  return {
    id: row.id,
    entityType: row.entity_type,
    consentVersion: row.consent_version,
    dataCategories: row.data_categories,
    purposes: row.purposes,
    authorizedSignatory: row.authorized_signatory,
    status: row.status,
    acceptedAt: row.accepted_at.toISOString(),
    withdrawnAt: row.withdrawn_at?.toISOString() ?? null,
  };
}

function parseStringArray(
  value: unknown,
  allowed: readonly string[],
  field: string,
): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, `${field} must be a non-empty array`);
  }

  const unique = [...new Set(value)];

  for (const item of unique) {
    if (typeof item !== "string" || !allowed.includes(item)) {
      throw new ApiError(400, `${field} contains an unsupported value`);
    }
  }

  return unique as string[];
}

export const kycService = {
  async recordConsent(
    userId: string,
    input: KycConsentInput,
    requestMeta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<KycConsent> {
    if (input.accepted !== true) {
      throw new ApiError(400, "Consent must be accepted before it can be recorded");
    }

    if (input.authorizedSignatory !== true) {
      throw new ApiError(
        400,
        "You must confirm that you are an authorised signatory of the business",
      );
    }

    const consentVersion =
      typeof input.consentVersion === "string" ? input.consentVersion.trim() : "";

    if (!consentVersion || consentVersion.length > 32) {
      throw new ApiError(400, "A valid consent version is required");
    }

    const dataCategories = parseStringArray(
      input.dataCategories,
      KYC_DATA_CATEGORIES,
      "dataCategories",
    );
    const purposes = parseStringArray(input.purposes, KYC_PURPOSES, "purposes");

    const { rows } = await query<KycConsentRow>(
      `INSERT INTO kyc_consents (
        id,
        user_id,
        entity_type,
        consent_version,
        data_categories,
        purposes,
        authorized_signatory,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, 'company', $3, $4, $5, true, $6, $7)
      RETURNING ${consentColumns}`,
      [
        randomUUID(),
        userId,
        consentVersion,
        dataCategories,
        purposes,
        requestMeta.ipAddress,
        requestMeta.userAgent,
      ],
    );

    return toConsent(rows[0]);
  },

  async getLatestConsent(userId: string): Promise<KycConsent | null> {
    const { rows } = await query<KycConsentRow>(
      `SELECT ${consentColumns}
       FROM kyc_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC
       LIMIT 1`,
      [userId],
    );

    return rows[0] ? toConsent(rows[0]) : null;
  },

  async withdrawLatestConsent(userId: string): Promise<KycConsent | null> {
    const { rows } = await query<KycConsentRow>(
      `UPDATE kyc_consents
       SET status = 'withdrawn', withdrawn_at = now()
       WHERE id = (
         SELECT id
         FROM kyc_consents
         WHERE user_id = $1 AND status = 'active'
         ORDER BY accepted_at DESC
         LIMIT 1
       )
       RETURNING ${consentColumns}`,
      [userId],
    );

    return rows[0] ? toConsent(rows[0]) : null;
  },
};
