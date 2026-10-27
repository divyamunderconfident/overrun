// Adapted from "Token Counter and Cost Meter" (AI Engineering from Scratch), stage 4 and its replay script.
// Copyright (c) 2026 Rohit Ghumare. Used under the MIT License; see LICENSE.
import { checked, invalid, limit } from "./errors";
import { cost, type Rates } from "./pricing";
import { normalizeUsage } from "./usage";

/** R5 / original stage 4: admit only if spent + quote <= limit. Returns the new state; nothing changes on rejection. */
export function reserve(spent: bigint, quote: bigint, budget: bigint): { spent: bigint; remaining: bigint } {
  const next = checked(spent + quote);
  if (next > budget) throw limit("over budget");
  return { spent: next, remaining: budget - next };
}

export type LogRequest = {
  id: string;
  estimate: { input_tokens: number; output_limit: number; cached_tokens?: number };
  usage: unknown;
};
export type Settlement = {
  id: string;
  status: "settled" | "overrun" | "blocked";
  reserved: bigint;
  actual: bigint;
  unused: bigint;
  overrun: bigint;
  reason?: string;
};

/** Port of the original project's replay script: reserve the quote, settle on actual usage, block what does not fit. */
export function replay(log: { limit: number | bigint; rates: Rates; requests: LogRequest[] }) {
  const budget = checked(BigInt(log.limit));
  let spent = 0n;
  const seen = new Set<string>();
  const settlements: Settlement[] = [];
  for (const r of log.requests) {
    if (typeof r.id !== "string" || !r.id || seen.has(r.id)) throw invalid("unique request id required");
    seen.add(r.id);
    const e = r.estimate;
    const quote = cost(
      normalizeUsage({ input_tokens: e.input_tokens, output_tokens: e.output_limit, input_tokens_details: { cached_tokens: e.cached_tokens ?? 0 } }),
      log.rates,
    );
    if (spent + quote > budget) {
      settlements.push({ id: r.id, status: "blocked", reserved: 0n, actual: 0n, unused: 0n, overrun: 0n, reason: "reservation exceeds remaining budget" });
      continue;
    }
    const actual = cost(normalizeUsage(r.usage), log.rates);
    spent = checked(spent + actual);
    settlements.push({
      id: r.id,
      status: actual <= quote ? "settled" : "overrun",
      reserved: quote,
      actual,
      unused: quote > actual ? quote - actual : 0n,
      overrun: actual > quote ? actual - quote : 0n,
    });
    if (spent > budget) break;
  }
  return { unit: "nano_dollars" as const, limit: budget, spent, remaining: budget > spent ? budget - spent : 0n, overBudget: spent > budget, settlements };
}
