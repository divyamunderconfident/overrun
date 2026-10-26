import { checked, invalid } from "./errors";
import type { Usage } from "./usage";

/** Integer nano-dollars per token. */
export type Rates = { input: bigint; output: bigint; cached: bigint };

/** R4: uncached input, cached input and output are charged separately, with checked u64 maths. */
export function cost(u: Usage, r: Rates): bigint {
  if (u.cached > u.input) throw invalid("cached exceeds input");
  if (r.input < 0n || r.output < 0n || r.cached < 0n) throw invalid("rates must be nonnegative");
  const a = checked((u.input - u.cached) * r.input);
  const b = checked(u.cached * r.cached);
  const c = checked(u.output * r.output);
  return checked(checked(a + b) + c);
}

/** Nano-dollars as dollars, trailing zeros trimmed (at least 2 decimals). No floats. */
export function formatUsd(nano: bigint): string {
  const sign = nano < 0n ? "-" : "";
  const n = nano < 0n ? -nano : nano;
  const frac = (n % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${sign}$${n / 1_000_000_000n}.${frac}`;
}
