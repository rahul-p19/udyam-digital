import crypto from "node:crypto";
import { query } from "../db/pool.js";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  kycVerified: boolean;
}

const USER_COLUMNS = "id, email, password_hash, name, created_at, updated_at";

export const userModel = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  },

  async findById(id: string): Promise<User | null> {
    const result = await query<User>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  async create(input: {
    email: string;
    passwordHash: string;
    name?: string | null;
  }): Promise<User> {
    const result = await query<User>(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${USER_COLUMNS}`,
      [crypto.randomUUID(), input.email, input.passwordHash, input.name ?? null],
    );
    return result.rows[0];
  },

  toPublic(user: User, kycVerified = false): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      kycVerified,
    };
  },
};
