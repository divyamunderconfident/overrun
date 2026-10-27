import { describe, expect, it } from "vitest";
import { reconcile, reconcileOne, toCsv, toMarkdown, type UsageLog } from "./reconcile";
import { RATE_CARDS } from "./ratecards";
import demo from "../public/data/demo-log.json";

const rates = { input: 2n, output: 5n, cached: 1n };

describe("reconcile", () => {
  it("splits a hand-made gap into reasons that add up exactly", () => {
    const r = reconcileOne(
      { id: "a", provider: "openai", model: "m", kind: "prose", lang: "Hindi", system: "be brief", prompt: "x".repeat(40), output_limit: 10, local: { tokenizer: "t", prompt: 30, system: 3 }, usage: { prompt_tokens: 40, completion_tokens: 6, prompt_tokens_details: { cached_tokens: 8 } } },
      rates,
      { m: { noSystem: 4, withSystem: 5 } },
    );
    expect(r.estimateTokens).toBe(10n);
    expect(r.reasons.map((x) => x.tokens)).toEqual([20n, 3n, 5n, 6n, -8n, 2n]);
    expect(r.reasons.reduce((a, x) => a + x.cost, 0n)).toBe(r.gapCost);
    expect(r.reasons.filter((x) => x.input).reduce((a, x) => a + x.tokens, 0n)).toBe(r.actual.input - r.estimateTokens);
  });

  it("explains at least 90% of the gap on the bundled demo log, and every row adds up", () => {
    const card = RATE_CARDS.find((c) => c.id === demo.rateCard)!;
    const report = reconcile(demo as UsageLog, card.rates);
    expect(report.rows.length).toBe(demo.requests.length);
    for (const r of report.rows) expect(r.reasons.reduce((a, x) => a + x.cost, 0n)).toBe(r.gapCost);
    expect(report.totals.explainedBp).toBeGreaterThanOrEqual(9000n);
    const held = reconcile({ ...(demo as UsageLog), requests: demo.requests.filter((r) => demo.heldOut.includes(r.id)) } as UsageLog, card.rates);
    expect(held.rows.length).toBe(25);
    expect(held.totals.explainedBp).toBeGreaterThanOrEqual(9000n);
    expect(toCsv(report).split("\n")[0]).toContain("reason_cost_nano");
    expect(toMarkdown(report, card.model)).toContain("estimate");
  });
});
