import { invalid } from "./errors";

/** Unicode scalar values (code points), not UTF-16 units or bytes. */
export const charCount = (text: string) => BigInt([...text].length);

/** R1: ceil(chars / ratio). Always an estimate, never a count. */
export function estimate(text: string, charsPerToken: bigint = 4n): bigint {
  if (charsPerToken <= 0n) throw invalid("ratio must be positive");
  const n = charCount(text);
  return n / charsPerToken + (n % charsPerToken !== 0n ? 1n : 0n);
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
