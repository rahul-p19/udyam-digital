import crypto from "node:crypto";
import { query } from "../db/pool.js";

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  jti: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

const REFRESH_TOKEN_COLUMNS =
  "id, user_id, jti, expires_at, revoked_at, created_at";

export const refreshTokenModel = {
  async create(input: {
    userId: string;
    jti: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const result = await query<RefreshTokenRecord>(
      `INSERT INTO refresh_tokens (id, user_id, jti, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING ${REFRESH_TOKEN_COLUMNS}`,
      [crypto.randomUUID(), input.userId, input.jti, input.expiresAt],
    );
    return result.rows[0];
  },

  async findActiveByJti(jti: string): Promise<RefreshTokenRecord | null> {
    const result = await query<RefreshTokenRecord>(
      `SELECT ${REFRESH_TOKEN_COLUMNS}
       FROM refresh_tokens
       WHERE jti = $1 AND revoked_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [jti],
    );
    return result.rows[0] ?? null;
  },

  async revokeByJti(jti: string): Promise<boolean> {
    const result = await query(
      `UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE jti = $1 AND revoked_at IS NULL`,
      [jti],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  },
};
