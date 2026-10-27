// Typed views over results/study.json (copied to public/data by study/run.ts). No numbers live here.
import study from "@/public/data/study.json";
import { RATE_CARDS } from "@/lib/ratecards";
import type { TokenizerId } from "@/lib/tokenizers";

export { study };
export type ByTok = Record<TokenizerId, { tokens: number; charsPerToken: number; errorPct: number; factor: number }>;
export type Group = { group: string; kind: string; samples: number; chars: number; estimate: number; byTokenizer: ByTok };
export const groups = study.groups as Group[];
export const group = (name: string) => groups.find((g) => g.group === name)!;

/** The two models the study measured, with their median overhead and their dated rate card. */
export const MODELS = study.real.summary.map((s) => ({
  model: s.model,
  provider: s.provider,
  tokenizer: s.tokenizer as TokenizerId,
  overhead: { noSystem: s.overheadNoSystem!, withSystem: s.overheadWithSystem! },
  medianEstimateErrorPct: s.medianEstimateErrorPct,
  card: RATE_CARDS.find((c) => c.model === s.model)!,
}));
export type Model = (typeof MODELS)[number];

export const fmt = (n: number | bigint) => n.toLocaleString("en-US");
export const host = (url: string) => new URL(url).host;
export const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const groupLabel = (g: string) => ({ code: "Code", json: "JSON", markdown: "Markdown", emoji: "Emoji" })[g] ?? g;
