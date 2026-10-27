// Stages 1-4 are ported 1:1 from "Token Counter and Cost Meter" (AI Engineering from Scratch).
// Copyright (c) 2026 Rohit Ghumare. Used under the MIT License; see LICENSE.
import { describe, expect, it } from "vitest";
import { U64_MAX } from "./errors";
import { estimate, labelledEstimate } from "./estimate";
import { parseUsageLine, normalizeUsage } from "./usage";
import { cost, formatUsd } from "./pricing";
import { reserve, replay } from "./ledger";
import { RATE_CARDS } from "./ratecards";
import example from "./original-usage.example.json";

const R = (input: bigint, output: bigint, cached: bigint) => ({ input, output, cached });
const kind = (f: () => unknown) => { try { f(); } catch (e) { return (e as { kind?: string }).kind ?? "error"; } return "ok"; };

describe("stage 1: estimate", () => {
  it("empty", () => expect(estimate("", 4n)).toBe(0n));
  it("round_up", () => expect(estimate("hello", 4n)).toBe(2n));
  it("exact", () => expect(estimate("abcd", 4n)).toBe(1n));
  it("unicode", () => expect(estimate("é🙂", 1n)).toBe(2n));
  it("zero_ratio", () => expect(kind(() => estimate("a", 0n))).toBe("invalid"));
  it("README worked case: 21 characters at ratio 4 -> 6", () => expect(estimate("a".repeat(20) + "🙂", 4n)).toBe(6n));
  it("is labelled an estimate with its rule", () => {
    const e = labelledEstimate("hello");
    expect(e.label).toBe("estimate");
    expect(e.rule).toBe("ceil(5 characters / 4)");
  });
});

describe("stage 2: validate usage", () => {
  it("normal", () => expect(parseUsageLine("100,20,40").cached).toBe(40n));
  it("zeros", () => expect(parseUsageLine("0,0,0").input).toBe(0n));
  it("cached_subset", () => expect(kind(() => parseUsageLine("1,2,3"))).toBe("invalid"));
  it("negative", () => expect(kind(() => parseUsageLine("-1,2,0"))).toBe("invalid"));
  it("missing", () => expect(kind(() => parseUsageLine("1,2"))).toBe("invalid"));
});

describe("stage 3: price with checked integers", () => {
  it("weighted", () => expect(cost(R(100n, 20n, 40n), R(2n, 5n, 1n))).toBe(260n));
  it("zero_rates", () => expect(cost(R(9n, 4n, 0n), R(0n, 0n, 0n))).toBe(0n));
  it("all_cached", () => expect(cost(R(10n, 0n, 10n), R(99n, 99n, 1n))).toBe(10n));
  it("overflow", () => expect(kind(() => cost(R(U64_MAX, 0n, 0n), R(2n, 1n, 1n)))).toBe("limit"));
  it("invalid_usage", () => expect(kind(() => cost(R(0n, 0n, 1n), R(1n, 1n, 1n)))).toBe("invalid"));
});

describe("stage 4: ledger", () => {
  it("normal", () => expect(reserve(10n, 5n, 20n)).toEqual({ spent: 15n, remaining: 5n }));
  it("boundary", () => expect(reserve(10n, 10n, 20n).remaining).toBe(0n));
  it("reject_atomic", () => expect(kind(() => reserve(10n, 11n, 20n))).toBe("limit"));
  it("overflow_atomic", () => expect(kind(() => reserve(U64_MAX, 1n, U64_MAX))).not.toBe("ok"));
  it("zero", () => expect(reserve(0n, 0n, 0n).remaining).toBe(0n));
  it("replays the original example to its recorded output", () => {
    const out = replay({ limit: example.limit, rates: R(2n, 5n, 1n), requests: example.requests });
    expect(out.spent).toBe(570n);
    expect(out.remaining).toBe(430n);
    expect(out.settlements.map((s) => [s.id, s.status, s.reserved, s.actual])).toEqual([
      ["orchard-summary", "settled", 600n, 260n],
      ["orchard-check", "settled", 600n, 310n],
      ["long-report", "blocked", 0n, 0n],
    ]);
  });
});

describe("R3: provider usage formats", () => {
  it("openai chat with cached tokens", () =>
    expect(normalizeUsage({ usage: { prompt_tokens: 120, completion_tokens: 7, prompt_tokens_details: { cached_tokens: 64 } } })).toEqual({ provider: "openai", input: 120n, output: 7n, cached: 64n }));
  it("openai responses", () =>
    expect(normalizeUsage({ input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 40 } })).toMatchObject({ input: 100n, cached: 40n }));
  it("anthropic adds cache reads and writes back into input", () =>
    expect(normalizeUsage({ usage: { input_tokens: 10, cache_read_input_tokens: 90, cache_creation_input_tokens: 5, output_tokens: 3 } })).toEqual({ provider: "anthropic", input: 105n, output: 3n, cached: 90n }));
  it("gemini counts thinking as output", () =>
    expect(normalizeUsage({ usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 4, thoughtsTokenCount: 6, cachedContentTokenCount: 20 } })).toEqual({ provider: "gemini", input: 50n, output: 10n, cached: 20n }));
  it("groq", () =>
    expect(normalizeUsage({ usage: { prompt_tokens: 40, completion_tokens: 2 } }, "groq")).toEqual({ provider: "groq", input: 40n, output: 2n, cached: 0n }));
  it("rejects fractional, negative, boolean and cached > input", () => {
    expect(kind(() => normalizeUsage({ prompt_tokens: 1.5, completion_tokens: 0 }))).toBe("invalid");
    expect(kind(() => normalizeUsage({ prompt_tokens: -1, completion_tokens: 0 }))).toBe("invalid");
    expect(kind(() => normalizeUsage({ prompt_tokens: true, completion_tokens: 0 }))).toBe("invalid");
    expect(kind(() => normalizeUsage({ prompt_tokens: 5, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 6 } }))).toBe("invalid");
    expect(kind(() => normalizeUsage({ foo: 1 }))).toBe("invalid");
  });
});

describe("R4: money", () => {
  it("formats nano-dollars without floats", () => {
    expect(formatUsd(0n)).toBe("$0.00");
    expect(formatUsd(260n)).toBe("$0.00000026");
    expect(formatUsd(1_500_000_000n)).toBe("$1.50");
  });
  it("rate cards are dated, sourced integers", () => {
    for (const c of RATE_CARDS) {
      expect(c.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.source).toMatch(/^https:\/\//);
      expect(typeof c.rates.input).toBe("bigint");
    }
  });
});
