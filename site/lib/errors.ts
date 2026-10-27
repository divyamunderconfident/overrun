// Adapted from "Token Counter and Cost Meter" (AI Engineering from Scratch), types.rs.
// Copyright (c) 2026 Rohit Ghumare. Used under the MIT License; see LICENSE.
// Mirrors the original project's Error enum: Invalid(reason) or Limit (overflow / over budget).
export class OverrunError extends Error {
  constructor(public kind: "invalid" | "limit", message: string = kind) {
    super(message);
  }
}
export const invalid = (why: string) => new OverrunError("invalid", why);
export const limit = (why = "limit") => new OverrunError("limit", why);

// The original core works in u64; we keep the same ceiling so its overflow tests port 1:1.
export const U64_MAX = (1n << 64n) - 1n;
export function checked(x: bigint): bigint {
  if (x < 0n || x > U64_MAX) throw limit("u64 overflow");
  return x;
}
