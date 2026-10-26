"use client";
import { useState } from "react";
import { labelledEstimate } from "@/lib/estimate";
import { cost, formatUsd, type Rates } from "@/lib/pricing";
import { RATE_CARDS } from "@/lib/ratecards";
import { loadTokenizer, TOKENIZERS, type TokenizerId } from "@/lib/tokenizers";
import { RateCardPicker } from "./RateCardPicker";

const digits = (v: string, fallback: bigint) => (/^\d+$/.test(v) ? BigInt(v) : fallback);

export default function Calculator() {
  const [prompt, setPrompt] = useState("Summarise this support ticket in one sentence: the customer was charged twice for the March invoice.");
  const [system, setSystem] = useState("You are a helpful support assistant.");
  const [output, setOutput] = useState("200");
  const [ratio, setRatio] = useState("4");
  const [cardId, setCardId] = useState(RATE_CARDS[0].id);
  const [rates, setRates] = useState<Rates>(RATE_CARDS[0].rates);
  const [counts, setCounts] = useState<Partial<Record<TokenizerId, number | "loading" | "error">>>({});

  const r = digits(ratio, 4n) || 4n;
  const p = labelledEstimate(prompt, r);
  const s = labelledEstimate(system, r);
  const out = digits(output, 0n);
  const priced = (input: bigint) => formatUsd(cost({ input, output: out, cached: 0n }, rates));

  async function count(id: TokenizerId) {
    setCounts((c) => ({ ...c, [id]: "loading" }));
    try {
      const n = await loadTokenizer(id);
      setCounts((c) => ({ ...c, [id]: n(system) + n(prompt) }));
    } catch {
      setCounts((c) => ({ ...c, [id]: "error" }));
    }
  }

  return (
    <div className="space-y-4">
      <h1>What will this request cost?</h1>
      <p className="text-sm text-zinc-500">An estimate first, then real tokenizer counts next to it. Nothing leaves your browser.</p>
      <label className="block text-sm">System prompt<textarea className="mt-1 block w-full" rows={2} value={system} onChange={(e) => setSystem(e.target.value)} /></label>
      <label className="block text-sm">User prompt<textarea className="mt-1 block w-full" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label>Expected output tokens <input className="w-20" inputMode="numeric" value={output} onChange={(e) => setOutput(e.target.value)} /></label>
        <label>Characters per token <input className="w-14" inputMode="numeric" value={ratio} onChange={(e) => setRatio(e.target.value)} /></label>
      </div>
      <RateCardPicker cardId={cardId} rates={rates} onChange={(id, x) => { setCardId(id); setRates(x); }} />

      <h2>Input tokens</h2>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Method</th><th>Input tokens</th><th>Cost incl. {out.toString()} output tokens</th><th /></tr></thead>
          <tbody>
            <tr>
              <td><b>estimate</b> <span className="text-xs text-zinc-500">{s.rule} + {p.rule}</span></td>
              <td>{(s.tokens + p.tokens).toString()}</td>
              <td>{priced(s.tokens + p.tokens)} <span className="text-xs text-zinc-500">estimate</span></td>
              <td />
            </tr>
            {TOKENIZERS.map((t) => {
              const c = counts[t.id];
              return (
                <tr key={t.id}>
                  <td>{t.label} <span className="text-xs text-zinc-500">{t.usedBy}</span></td>
                  <td>{typeof c === "number" ? c : c === "loading" ? "loading…" : c === "error" ? "failed to load" : "–"}</td>
                  <td>{typeof c === "number" ? priced(BigInt(c)) : ""}</td>
                  <td><button disabled={c === "loading"} onClick={() => count(t.id)}>{t.hf ? "Download & count" : "Count"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Tokenizer counts are text only. Providers add chat-format tokens on top (the <a href="/findings/">study</a> measured them), and the
        Gemma 3 tokenizer stands in for Gemini&apos;s, which is not public. Llama and Gemma tokenizers are downloaded from Hugging Face on first use.
      </p>
    </div>
  );
}
