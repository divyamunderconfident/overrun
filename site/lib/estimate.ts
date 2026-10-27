// Adapted from "Token Counter and Cost Meter" (AI Engineering from Scratch), stage 1.
// Copyright (c) 2026 Rohit Ghumare. Used under the MIT License; see LICENSE.
import { invalid } from "./errors";

/** Unicode scalar values (code points), not UTF-16 units or bytes. */
export const charCount = (text: string) => BigInt([...text].length);

/** ceil(n / ratio) for a known number of characters. */
export function estimateChars(n: bigint, charsPerToken: bigint = 4n): bigint {
  if (charsPerToken <= 0n) throw invalid("ratio must be positive");
  return n / charsPerToken + (n % charsPerToken !== 0n ? 1n : 0n);
}

/** R1: ceil(chars / ratio). Always an estimate, never a count. */
export function estimate(text: string, charsPerToken: bigint = 4n): bigint {
  return estimateChars(charCount(text), charsPerToken);
}

export function labelledEstimate(text: string, charsPerToken: bigint = 4n) {
  const chars = charCount(text);
  return {
    label: "estimate" as const,
    rule: `ceil(${chars} characters / ${charsPerToken})`,
    chars,
    tokens: estimate(text, charsPerToken),
  };
}
