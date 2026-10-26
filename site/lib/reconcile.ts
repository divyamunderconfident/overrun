// R6: estimate vs actual per request, with the gap split into named reasons.
import { estimate } from "./estimate";
import { cost, formatUsd, type Rates } from "./pricing";
import { normalizeUsage, type Provider } from "./usage";

export type LogEntry = {
  id: string;
  provider: Provider;
  model: string;
  kind: string;
  lang: string;
  system: string;
  prompt: string;
  output_limit: number;
  local: { tokenizer: string; prompt: number; system: number };
  usage: unknown;
};
export type UsageLog = {
  limit: number;
  rateCard?: string;
  overhead?: Record<string, { noSystem: number | null; withSystem: number | null }>;
  requests: LogEntry[];
};

export type Reason = { reason: string; tokens: bigint; cost: bigint };

export function reconcileOne(e: LogEntry, rates: Rates, overhead: UsageLog["overhead"] = {}) {
  const u = normalizeUsage(e.usage, e.provider);
  const est = estimate(e.prompt, 4n);
  const text = BigInt(e.local.prompt) - est;
  const system = BigInt(e.local.system);
  const o = overhead[e.model];
  const fmt = BigInt((e.system ? o?.withSystem : o?.noSystem) ?? 0);
  const unexplained = u.input - est - text - system - fmt;
  const label = e.kind === "prose" ? `${e.lang} text` : `${e.kind} text`;
  const reasons: Reason[] = [
    { reason: `${label} vs 4-characters rule (${e.local.tokenizer})`, tokens: text, cost: text * rates.input },
    { reason: "system prompt left out of estimate", tokens: system, cost: system * rates.input },
    { reason: "chat-format overhead (measured in study)", tokens: fmt, cost: fmt * rates.input },
    { reason: "output tokens left out of estimate", tokens: u.output, cost: u.output * rates.output },
    { reason: "cached-input discount", tokens: -u.cached, cost: -u.cached * (rates.input - rates.cached) },
    { reason: "unexplained", tokens: unexplained, cost: unexplained * rates.input },
  ];
  const estimateCost = cost({ input: est, output: 0n, cached: 0n }, rates);
  const actualCost = cost(u, rates);
  return { id: e.id, model: e.model, estimateTokens: est, actual: u, estimateCost, actualCost, gapCost: actualCost - estimateCost, reasons };
}

const abs = (x: bigint) => (x < 0n ? -x : x);

export function reconcile(log: UsageLog, rates: Rates) {
  const rows = log.requests.map((e) => reconcileOne(e, rates, log.overhead));
  const gapTokens = rows.reduce((a, r) => a + abs(r.actual.input - r.estimateTokens), 0n);
  const unexplainedTokens = rows.reduce((a, r) => a + abs(r.reasons.at(-1)!.tokens), 0n);
  const totals = {
    estimateCost: rows.reduce((a, r) => a + r.estimateCost, 0n),
    actualCost: rows.reduce((a, r) => a + r.actualCost, 0n),
    gapTokens,
    unexplainedTokens,
    // Share of the input-token gap explained by named reasons, in basis points (integer).
    explainedBp: gapTokens === 0n ? 10000n : ((gapTokens - unexplainedTokens) * 10000n) / gapTokens,
  };
  return { rows, totals };
}

export type Report = ReturnType<typeof reconcile>;
const pct = (bp: bigint) => `${bp / 100n}.${(bp % 100n).toString().padStart(2, "0")}%`;
export const formatBp = pct;

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(report: Report): string {
  const head = ["id", "model", "estimate_tokens", "actual_input", "actual_output", "actual_cached", "estimate_cost_nano", "actual_cost_nano", "reason", "reason_tokens", "reason_cost_nano"];
  const lines = report.rows.flatMap((r) =>
    r.reasons.map((x) => [r.id, r.model, r.estimateTokens, r.actual.input, r.actual.output, r.actual.cached, r.estimateCost, r.actualCost, x.reason, x.tokens, x.cost].map((v) => csvCell(String(v))).join(",")),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}

export function toMarkdown(report: Report, rateLabel: string): string {
  const t = report.totals;
  return [
    "# Overrun reconciliation report",
    "",
    `Rate card: ${rateLabel}. Estimates use ceil(characters / 4) on the user prompt and are labelled "estimate".`,
    "",
    `- Estimated cost (estimate): ${formatUsd(t.estimateCost)}`,
    `- Actual cost from reported usage: ${formatUsd(t.actualCost)}`,
    `- Input-token gap explained by named reasons: ${pct(t.explainedBp)} (unexplained ${t.unexplainedTokens} of ${t.gapTokens} tokens)`,
    "",
    "| Request | Model | Estimate (tokens) | Actual input | Output | Cached | Estimate cost | Actual cost | Reasons (tokens) |",
    "|---|---|---|---|---|---|---|---|---|",
    ...report.rows.map((r) =>
      `| ${r.id} | ${r.model} | ${r.estimateTokens} | ${r.actual.input} | ${r.actual.output} | ${r.actual.cached} | ${formatUsd(r.estimateCost)} | ${formatUsd(r.actualCost)} | ${r.reasons.filter((x) => x.tokens !== 0n).map((x) => `${x.reason}: ${x.tokens > 0n ? "+" : ""}${x.tokens}`).join("; ")} |`,
    ),
    "",
  ].join("\n");
}
