// Builds study/corpus.json once: ~200 samples, each with its source and licence. Rerun only to rebuild the corpus.
import { readFileSync, writeFileSync } from "node:fs";

// `source` is the exact provenance (kept in this repo file); `credit` is the generic label the study and site show.
type Sample = { id: string; kind: "prose" | "code" | "json" | "markdown" | "emoji"; lang: string; text: string; source: string; licence: string; credit?: string };
const samples: Sample[] = [];

const NTREX = "https://raw.githubusercontent.com/MicrosoftTranslator/NTREX/main/NTREX-128/newstest2019-ref.";
const LANGS: [string, string][] = [
  ["eng-US", "English"], ["spa", "Spanish"], ["fra", "French"], ["deu", "German"], ["rus", "Russian"],
  ["arb", "Arabic"], ["hin", "Hindi"], ["tam", "Tamil"], ["zho-CN", "Chinese"], ["jpn", "Japanese"],
];
const get = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

// Prose: the same 15 NTREX-128 lines (parallel) in each language.
const files = await Promise.all(LANGS.map(([code]) => get(`${NTREX}${code}.txt`).then((t) => t.split(/\r?\n/))));
const picks: number[] = [];
for (let i = 50; picks.length < 15; i += 97) if (files[0][i].length >= 80) picks.push(i);
LANGS.forEach(([code, name], li) => {
  for (const line of picks) {
    if (!files[li][line]?.trim()) throw new Error(`empty line ${line} in ${code}`);
    samples.push({ id: `prose-${code}-${line + 1}`, kind: "prose", lang: name, text: files[li][line].trim(), source: `NTREX-128 newstest2019-ref.${code}.txt line ${line + 1} (github.com/MicrosoftTranslator/NTREX)`, licence: "CC BY-SA 4.0" });
  }
});

// Code: the original course project's solution files (MIT), split at blank lines into ~600-char chunks.
const ORIG = "https://raw.githubusercontent.com/rohitg00/ai-engineering-from-scratch/main/projects/token-counter-and-cost-meter/";
const chunks = (text: string, max = 600) => {
  const out: string[] = [];
  let cur = "";
  for (const block of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    if (cur && cur.length + block.length > max) { out.push(cur); cur = ""; }
    cur = cur ? `${cur}\n\n${block}` : block;
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.length >= 120);
};
const codeFiles = ["solution/stage1.rs", "solution/stage2.rs", "solution/stage3.rs", "solution/stage4.rs", "solution/cli.rs", "solution/usage.py"];
let n = 0;
for (const f of codeFiles) {
  for (const c of chunks(await get(ORIG + f))) {
    if (n++ >= 15) break;
    samples.push({ id: `code-${f.endsWith(".py") ? "python" : "rust"}-${n}`, kind: "code", lang: f.endsWith(".py") ? "Python" : "Rust", text: c, source: `ai-engineering-from-scratch/projects/token-counter-and-cost-meter/${f}`, licence: "MIT" });
  }
}
// ...topped up to 15 with this repo's TypeScript core.
for (const f of ["usage.ts", "ledger.ts", "pricing.ts", "estimate.ts", "tokenizers.ts"]) {
  for (const c of chunks(readFileSync(new URL(`../site/lib/${f}`, import.meta.url), "utf8"))) {
    if (n++ >= 15) break;
    samples.push({ id: `code-typescript-${n}`, kind: "code", lang: "TypeScript", text: c, source: `overrun/site/lib/${f}`, licence: "MIT (this repo)" });
  }
}

// Markdown: the original project's docs (MIT) and this repo's PRD.
n = 0;
for (const [label, text] of [
  ["ai-engineering-from-scratch/projects/token-counter-and-cost-meter/README.md", await get(ORIG + "README.md")],
  ["ai-engineering-from-scratch/projects/token-counter-and-cost-meter/stages/03-price-with-checked-integers/docs/en.md", await get(ORIG + "stages/03-price-with-checked-integers/docs/en.md")],
  ["overrun/docs/PRD.md", readFileSync(new URL("../docs/PRD.md", import.meta.url), "utf8")],
] as const) {
  for (const c of chunks(text, 800).slice(0, 4)) samples.push({ id: `markdown-${++n}`, kind: "markdown", lang: "English", text: c, source: label, licence: label.startsWith("overrun") ? "MIT (this repo)" : "MIT" });
}

// JSON: synthetic API-style payloads written for this study, each pretty and minified.
const names = ["Asha", "Bruno", "Chen", "Dana", "Emeka", "Farah"];
const payloads: [string, unknown][] = [
  ["chat-response", { id: "chatcmpl-0001", object: "chat.completion", model: "example-model", choices: [{ index: 0, message: { role: "assistant", content: "The invoice total is 42.50 EUR." }, finish_reason: "stop" }], usage: { prompt_tokens: 120, completion_tokens: 12, total_tokens: 132 } }],
  ["users", names.map((name, i) => ({ id: 1000 + i, name, email: `${name.toLowerCase()}@example.com`, active: i % 2 === 0, roles: i % 3 ? ["viewer"] : ["admin", "editor"] }))],
  ["orders", names.slice(0, 4).map((c, i) => ({ order_id: `ORD-${7700 + i}`, customer: c, items: [{ sku: `SKU-${i}A`, qty: i + 1, unit_price_cents: 1999 }, { sku: `SKU-${i}B`, qty: 1, unit_price_cents: 450 }], shipped: i < 2 }))],
  ["config", { service: "overrun", version: "1.4.2", retries: { max: 3, backoff_ms: [100, 400, 1600] }, features: { cache: true, streaming: false }, regions: ["eu-west-1", "us-east-1"] }],
  ["geo", { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [77.8956, 29.8649] }, properties: { name: "Roorkee" } }, { type: "Feature", geometry: { type: "Point", coordinates: [-0.1276, 51.5072] }, properties: { name: "London" } }] }],
  ["tool-call", { role: "assistant", tool_calls: [{ id: "call_01", type: "function", function: { name: "get_weather", arguments: JSON.stringify({ city: "Paris", unit: "celsius" }) } }] }],
];
for (const [name, value] of payloads) {
  samples.push({ id: `json-${name}-pretty`, kind: "json", lang: "JSON", text: JSON.stringify(value, null, 2), source: "synthetic, written for this study", licence: "MIT (this repo)" });
  samples.push({ id: `json-${name}-min`, kind: "json", lang: "JSON", text: JSON.stringify(value), source: "synthetic, written for this study", licence: "MIT (this repo)" });
}

// Emoji-heavy social text: synthetic posts written for this study.
const posts = [
  "just shipped the new feature 🚀🚀🚀 thank you team!!! 🙌🙌 #launchday #buildinpublic",
  "monday mood ☕️☕️☕️ + 47 unread emails 😵‍💫📧 send help 🆘",
  "the sunset tonight 🌅🧡💛💜 no filter needed ✨ #nofilter #goldenhour",
  "who else is watching the match?? ⚽️🔥 GOOOAL 🥳🥳🥳🇧🇷🇦🇷",
  "new recipe alert 🍝🧄🍅 took 20 min, tasted like 2 hours 😋👩‍🍳",
  "gym streak day 30 💪🏽💪🏽🏋️‍♀️ never skipping leg day again 🦵😤",
  "my cat knocked my coffee off the desk AGAIN 🐈‍⬛☕️💥 why is she like this 😂",
  "family trip 👨‍👩‍👧‍👦✈️🏝️ first time seeing the sea for the little one 🌊🐚",
  "rain all week ☔️🌧️⛈️ perfect excuse for books and tea 📚🍵",
  "exam results are out 📄😬... PASSED 🎉🎓🥹 thank you mom ❤️",
  "concert last night 🎸🎤🤘 my ears are still ringing 🔊😅 10/10 would go again",
  "plant update 🌱➡️🌿➡️🪴 she is thriving and so am i 💚✨",
];
posts.forEach((text, i) => samples.push({ id: `emoji-${i + 1}`, kind: "emoji", lang: "English + emoji", text, source: "synthetic, written for this study", licence: "MIT (this repo)" }));

// Public labels: the site and results name material generically; the MIT attribution lives on the Findings page.
for (const s of samples) {
  s.credit = s.kind === "prose" ? s.source.split(" line")[0]
    : s.source.startsWith(ORIG.split("/")[4]) ? (s.kind === "code" ? "Rust and Python sample code" : "technical documentation")
    : s.source.startsWith("overrun/site") ? "Overrun TypeScript source"
    : s.source.startsWith("overrun/docs") ? "Overrun product spec"
    : s.source;
}

writeFileSync(new URL("./corpus.json", import.meta.url), JSON.stringify({ built: new Date().toISOString().slice(0, 10), samples }, null, 1) + "\n");
const byKind = samples.reduce<Record<string, number>>((a, s) => ((a[s.kind] = (a[s.kind] ?? 0) + 1), a), {});
console.log(samples.length, "samples", byKind);
