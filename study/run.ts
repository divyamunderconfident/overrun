// R7: measure the 4-characters rule against real tokenizers, then check 50 real free-tier requests.
// Writes results/study.json, results/demo-log.json and RESULTS.md. Every model call is cached on disk
// (study/cache, gitignored) by a hash of its request, so reruns cost nothing and resume after a quota stop.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { estimate, charCount } from "../site/lib/estimate";
import { normalizeUsage } from "../site/lib/usage";
import { loadTokenizer, TOKENIZERS, type TokenizerId } from "../site/lib/tokenizers";

type Sample = { id: string; kind: string; lang: string; text: string; source: string; licence: string };
const corpus: { built: string; samples: Sample[] } = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8"));
const root = new URL("../", import.meta.url);
const r2 = (x: number) => Math.round(x * 100) / 100;
const r1 = (x: number) => Math.round(x * 10) / 10;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---------- Part 1: tokenizers vs the 4-characters estimate ----------
const counters = Object.fromEntries(await Promise.all(TOKENIZERS.map(async (t) => [t.id, await loadTokenizer(t.id)] as const))) as Record<TokenizerId, (s: string) => number>;
const rows = corpus.samples.map((s) => ({
  id: s.id, kind: s.kind, lang: s.lang,
  chars: Number(charCount(s.text)),
  estimate: Number(estimate(s.text, 4n)),
  tokens: Object.fromEntries(TOKENIZERS.map((t) => [t.id, counters[t.id](s.text)])) as Record<TokenizerId, number>,
}));
const groupOf = (r: (typeof rows)[number]) => (r.kind === "prose" ? r.lang : r.kind);
const groups = [...new Set(rows.map(groupOf))].map((group) => {
  const rs = rows.filter((r) => groupOf(r) === group);
  const chars = rs.reduce((a, r) => a + r.chars, 0);
  const est = rs.reduce((a, r) => a + r.estimate, 0);
  return {
    group, kind: rs[0].kind, samples: rs.length, chars, estimate: est,
    byTokenizer: Object.fromEntries(TOKENIZERS.map((t) => {
      const tokens = rs.reduce((a, r) => a + r.tokens[t.id], 0);
      // errorPct < 0 means the estimate is too low; factor = real tokens per estimated token.
      return [t.id, { tokens, charsPerToken: r2(chars / tokens), errorPct: r1(((est - tokens) / tokens) * 100), factor: r2(tokens / est) }];
    })),
  };
});
const worst = groups.flatMap((g) => TOKENIZERS.map((t) => ({ group: g.group, tokenizer: t.label, ...g.byTokenizer[t.id] }))).sort((a, b) => b.factor - a.factor);
const english = groups.find((g) => g.group === "English")!;

// ---------- Part 2: 50 real requests to free Groq and Gemini models ----------
const GROQ = process.env.GROQ_API_KEY;
const GEMINI = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
console.log(`keys: groq ${GROQ ? "present" : "missing"}, gemini ${GEMINI ? "present" : "missing"}`);
const SYSTEM = "You are a terse assistant. Reply with one word.";
const MODELS = {
  gptoss: { provider: "groq", model: "openai/gpt-oss-20b", tokenizer: "o200k_base", maxTokens: 64 },
  gemini: { provider: "gemini", model: "gemini-3.1-flash-lite", tokenizer: "gemma3", maxTokens: 16 },
} as const;
type ModelKey = keyof typeof MODELS;

// 25 prompts: 2 parallel lines per language + code, JSON, markdown, emoji. Each goes to Groq and to Gemini.
const prose = corpus.samples.filter((s) => s.kind === "prose");
const firstTwoLines = [...new Set(prose.map((s) => s.id.split("-").pop()))].slice(0, 2);
const prompts = [
  ...prose.filter((s) => firstTwoLines.includes(s.id.split("-").pop())),
  ...["code", "code", "json", "markdown", "emoji"].map((k, i) => corpus.samples.filter((s) => s.kind === k)[k === "code" ? i : 1]),
];
if (prompts.length !== 25) throw new Error(`expected 25 prompts, got ${prompts.length}`);
const plan = prompts.flatMap((s, i) => {
  const system = Math.floor(i / 2) % 2 === 0 ? SYSTEM : null;
  return [{ s, system, key: "gptoss" as ModelKey }, { s, system, key: "gemini" as ModelKey }];
});

const cacheDir = new URL("./cache/", import.meta.url);
mkdirSync(cacheDir, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stopped = new Set<string>();

async function call(key: ModelKey, system: string | null, user: string): Promise<unknown | null> {
  const m = MODELS[key];
  const groq = m.provider === "groq";
  const url = groq ? "https://api.groq.com/openai/v1/chat/completions" : `https://generativelanguage.googleapis.com/v1beta/models/${m.model}:generateContent`;
  const body = groq
    ? { model: m.model, max_tokens: m.maxTokens, ...(key === "gptoss" ? { reasoning_effort: "low" } : {}), messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }] }
    : { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { maxOutputTokens: m.maxTokens } };
  const file = new URL(createHash("sha256").update(JSON.stringify({ url, body })).digest("hex") + ".json", cacheDir);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const apiKey = groq ? GROQ : GEMINI;
  if (!apiKey || stopped.has(m.provider)) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(groq ? { authorization: `Bearer ${apiKey}` } : { "x-goog-api-key": apiKey }) }, body: JSON.stringify(body) });
    const text = await res.text();
    if (res.ok) { writeFileSync(file, text); return JSON.parse(text); }
    // Wait out short rate limits; a long wait means the daily quota is gone, so stop this provider cleanly.
    const wait = Number(res.headers.get("retry-after") ?? text.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? 999);
    if (res.status === 429 && wait <= 65) { console.log(`${m.provider}: rate limited, waiting ${wait}s`); await sleep((wait + 1) * 1000); continue; }
    if (res.status >= 500) { console.log(`${m.provider}: HTTP ${res.status}, retrying in 15s`); await sleep(15000); continue; }
    console.log(`${m.provider}: stopping (HTTP ${res.status}: ${text.slice(0, 160).replace(/\s+/g, " ")}). Rerun later to resume from cache.`);
    stopped.add(m.provider);
    return null;
  }
  stopped.add(m.provider);
  return null;
}

const real = [];
const demo = [];
for (const [i, p] of plan.entries()) {
  const m = MODELS[p.key];
  const response = await call(p.key, p.system, p.s.text);
  if (!response) continue;
  const u = normalizeUsage(response, m.provider as "groq" | "gemini");
  const count = counters[m.tokenizer];
  const promptTokens = count(p.s.text);
  const systemTokens = p.system ? count(p.system) : 0;
  const est = Number(estimate(p.s.text, 4n));
  const input = Number(u.input);
  real.push({
    id: `req-${String(i + 1).padStart(2, "0")}`, provider: m.provider, model: m.model, sample: p.s.id, kind: p.s.kind, lang: p.s.lang, system: !!p.system,
    chars: Number(charCount(p.s.text)), estimate: est, tokenizer: m.tokenizer, localPromptTokens: promptTokens, localSystemTokens: systemTokens,
    reportedInput: input, reportedOutput: Number(u.output), reportedCached: Number(u.cached),
    overhead: input - promptTokens - systemTokens,
    estimateErrorPct: r1(((est - input) / input) * 100),
  });
  const raw = response as { usage?: unknown; usageMetadata?: unknown };
  demo.push({ id: `req-${String(i + 1).padStart(2, "0")}`, provider: m.provider, model: m.model, kind: p.s.kind, lang: p.s.lang, system: p.system ?? "", prompt: p.s.text, output_limit: m.maxTokens, local: { tokenizer: m.tokenizer, prompt: promptTokens, system: systemTokens }, usage: raw.usage ?? { usageMetadata: raw.usageMetadata } });
}
console.log(`real requests with usage: ${real.length}/${plan.length}`);

const realSummary = (Object.keys(MODELS) as ModelKey[]).map((k) => {
  const rs = real.filter((r) => r.model === MODELS[k].model);
  if (!rs.length) return { model: MODELS[k].model, provider: MODELS[k].provider, requests: 0 };
  const ov = (sys: boolean) => rs.filter((r) => r.system === sys).map((r) => r.overhead);
  const range = (xs: number[]) => (xs.length ? { median: median(xs), min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null);
  return {
    model: MODELS[k].model, provider: MODELS[k].provider, tokenizer: MODELS[k].tokenizer, requests: rs.length,
    overheadNoSystem: range(ov(false)),
    overheadWithSystem: range(ov(true)),
    medianEstimateErrorPct: median(rs.map((r) => r.estimateErrorPct)),
    totalReportedInput: rs.reduce((a, r) => a + r.reportedInput, 0),
    totalEstimate: rs.reduce((a, r) => a + r.estimate, 0),
  };
});

// ---------- Write results ----------
const study = {
  generated: new Date().toISOString(),
  method: "estimate = ceil(Unicode characters / 4); tokens = local tokenizer count without special tokens; factor = real tokens / estimated tokens; errorPct = (estimate - real) / real * 100",
  corpus: { built: corpus.built, samples: corpus.samples.length, sources: [...new Set(corpus.samples.map((s) => `${s.source.split(" line")[0]} (${s.licence})`))] },
  tokenizers: TOKENIZERS,
  headline: { worst: worst[0], english: { tokenizer: "o200k_base", ...english.byTokenizer.o200k_base } },
  groups,
  rows,
  real: { requests: real.length, planned: plan.length, stoppedEarly: [...stopped], summary: realSummary, rows: real },
};
mkdirSync(new URL("results/", root), { recursive: true });
writeFileSync(new URL("results/study.json", root), JSON.stringify(study, null, 1) + "\n");
writeFileSync(new URL("results/demo-log.json", root), JSON.stringify({ note: "Real usage recorded by study/run.ts from free-tier Groq and Gemini calls.", limit: 2000000, rateCard: "groq-gpt-oss-20b", overhead: Object.fromEntries(realSummary.filter((s) => s.requests).map((s) => [s.model, { noSystem: s.overheadNoSystem?.median ?? null, withSystem: s.overheadWithSystem?.median ?? null }])), requests: demo }, null, 1) + "\n");

const tk = TOKENIZERS.map((t) => t.id);
const md = [
  "# Results",
  "",
  `Generated by \`study/run.ts\` on ${study.generated.slice(0, 10)} from \`results/study.json\`. Every number below is copied from that file by the script.`,
  "",
  "## Headline",
  "",
  `The 4-characters rule underestimates **${worst[0].group}** by **${worst[0].factor}×** on **${worst[0].tokenizer}** (${worst[0].charsPerToken} characters per token).`,
  "",
  `For English news prose on o200k_base it is ${english.byTokenizer.o200k_base.factor}× (${english.byTokenizer.o200k_base.charsPerToken} characters per token).`,
  "",
  "## Real tokens per estimated token (factor), by kind of text",
  "",
  `${corpus.samples.length} samples. Factor > 1 means the estimate is too low.`,
  "",
  `| Group | Samples | ${tk.join(" | ")} |`,
  `|---|---|${tk.map(() => "---").join("|")}|`,
  ...groups.map((g) => `| ${g.group} | ${g.samples} | ${tk.map((t) => `${g.byTokenizer[t].factor}× (${g.byTokenizer[t].charsPerToken} c/t)`).join(" | ")} |`),
  "",
  "## Real usage check",
  "",
  `${real.length} of ${plan.length} planned requests returned usage${stopped.size ? ` (stopped early for: ${[...stopped].join(", ")})` : ""}. Overhead = reported input tokens minus the local tokenizer's count of the prompt and system text.`,
  "",
  "| Model | Local tokenizer | Requests | Overhead, no system (median, min–max) | Overhead, with system (median, min–max) | Median estimate error |",
  "|---|---|---|---|---|---|",
  ...realSummary.filter((s) => s.requests).map((s) => {
    const f = (o: { median: number; min: number; max: number } | null | undefined) => (o ? `${o.median} (${o.min}–${o.max})` : "n/a");
    return `| ${s.model} | ${s.tokenizer} | ${s.requests} | ${f(s.overheadNoSystem)} | ${f(s.overheadWithSystem)} | ${s.medianEstimateErrorPct}% |`;
  }),
  "",
  "Gemini's tokenizer is not public; Gemma 3's is used as the closest open relative, so part of the Gemini overhead spread is tokenizer mismatch, not overhead.",
  "",
  "## Corpus sources",
  "",
  ...study.corpus.sources.map((s) => `- ${s}`),
  "",
].join("\n");
writeFileSync(new URL("RESULTS.md", root), md);
console.log(md.split("\n").slice(4, 9).join("\n"));
