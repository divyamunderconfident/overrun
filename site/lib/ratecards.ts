import type { Rates } from "./pricing";

export type RateCard = { id: string; provider: string; model: string; rates: Rates; asOf: string; source: string; note?: string };

// Dated fixtures, NOT current prices. Nano-dollars per token: $1 per 1M tokens = 1000.
// Copied by hand from each source page on the asOf date. Edit them in the UI or here.
export const RATE_CARDS: RateCard[] = [
  { id: "openai-gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", rates: { input: 150n, cached: 75n, output: 600n }, asOf: "2026-10-26", source: "https://developers.openai.com/api/docs/pricing" },
  { id: "openai-gpt-5-mini", provider: "openai", model: "gpt-5-mini", rates: { input: 250n, cached: 25n, output: 2000n }, asOf: "2026-10-26", source: "https://developers.openai.com/api/docs/pricing" },
  { id: "anthropic-haiku-4-5", provider: "anthropic", model: "claude-haiku-4-5", rates: { input: 1000n, cached: 100n, output: 5000n }, asOf: "2026-10-26", source: "https://platform.claude.com/docs/en/about-claude/pricing", note: "cache writes (1.25x input) not modelled" },
  { id: "anthropic-sonnet-4-5", provider: "anthropic", model: "claude-sonnet-4-5", rates: { input: 3000n, cached: 300n, output: 15000n }, asOf: "2026-10-26", source: "https://platform.claude.com/docs/en/about-claude/pricing", note: "cache writes (1.25x input) not modelled" },
  { id: "gemini-2-5-flash-lite", provider: "gemini", model: "gemini-2.5-flash-lite", rates: { input: 100n, cached: 10n, output: 400n }, asOf: "2026-10-26", source: "https://ai.google.dev/gemini-api/docs/pricing", note: "paid tier; cache storage per hour not modelled" },
  { id: "gemini-2-5-flash", provider: "gemini", model: "gemini-2.5-flash", rates: { input: 300n, cached: 30n, output: 2500n }, asOf: "2026-10-26", source: "https://ai.google.dev/gemini-api/docs/pricing", note: "paid tier; cache storage per hour not modelled" },
  { id: "gemini-3-1-flash-lite", provider: "gemini", model: "gemini-3.1-flash-lite", rates: { input: 250n, cached: 25n, output: 1500n }, asOf: "2026-10-27", source: "https://ai.google.dev/gemini-api/docs/pricing", note: "paid tier; cache storage per hour not modelled" },
  { id: "groq-gpt-oss-20b", provider: "groq", model: "openai/gpt-oss-20b", rates: { input: 75n, cached: 37n, output: 300n }, asOf: "2026-10-27", source: "https://console.groq.com/docs/model/openai/gpt-oss-20b" },
  { id: "groq-gpt-oss-120b", provider: "groq", model: "openai/gpt-oss-120b", rates: { input: 150n, cached: 150n, output: 600n }, asOf: "2026-10-26", source: "https://console.groq.com/docs/models", note: "no cached-input price listed; cached charged as input" },
];
