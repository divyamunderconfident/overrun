"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { charCount, estimate } from "@/lib/estimate";
import { cost, formatUsd, type Rates } from "@/lib/pricing";
import { RATE_CARDS } from "@/lib/ratecards";
import { loadTokenizer, TOKENIZERS, type Counter, type TokenizerId } from "@/lib/tokenizers";
import { fmt, group, groupLabel, host, longDate, MODELS } from "./data";
import { RateCardPicker } from "./RateCardPicker";

const SAMPLES = ["English", "Hindi", "Tamil", "Chinese", "code", "json"];
const AUTO: TokenizerId[] = ["o200k_base", "cl100k_base"]; // bundled with the page, loaded on first use without asking
const digits = (v: string, fallback: bigint) => (/^\d+$/.test(v) ? BigInt(v) : fallback);
const factor = (real: number, est: bigint) => (est > 0n ? real / Number(est) : 0);
const verdict = (real: number, est: bigint) => {
  const f = factor(real, est);
  return f >= 1 ? { dir: "UNDER", x: f } : { dir: "OVER", x: f > 0 ? 1 / f : 0 };
};

export function Calculator() {
  const [sample, setSample] = useState<string | null>("Tamil");
  const [text, setText] = useState("");
  const [system, setSystem] = useState("");
  const [output, setOutput] = useState("0");
  const [ratio, setRatio] = useState("4");
  const [modelIx, setModelIx] = useState(0);
  const [cardId, setCardId] = useState(MODELS[0].card.id);
  const [rates, setRates] = useState<Rates>(MODELS[0].card.rates);
  const [counters, setCounters] = useState<Partial<Record<TokenizerId, Counter | "loading" | "error">>>({});
  const [today, setToday] = useState("");
  const receipt = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const model = MODELS[modelIx];
  const custom = sample === null;

  async function load(id: TokenizerId) {
    if (counters[id] && counters[id] !== "error") return;
    setCounters((c) => ({ ...c, [id]: "loading" }));
    try {
      const n = await loadTokenizer(id);
      setCounters((c) => ({ ...c, [id]: n }));
    } catch {
      setCounters((c) => ({ ...c, [id]: "error" }));
    }
  }

  function reprint() {
    const el = receipt.current;
    if (!el?.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: "translateY(-100%)" }, { transform: "translateY(0)" }], { duration: 1700, easing: "steps(22, end)" });
    stamp.current?.animate(
      [{ opacity: 0, transform: "rotate(-5deg) scale(1.6)" }, { opacity: 1, transform: "rotate(-5deg) scale(1)" }],
      { duration: 350, delay: 1750, fill: "backwards", easing: "cubic-bezier(.2,1.4,.4,1)" },
    );
  }

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
    reprint();
  }, []);
  useEffect(() => { if (custom) AUTO.forEach(load); }, [custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => {
    const ratioN = digits(ratio, 4n) || 4n;
    const out = custom ? digits(output, 0n) : 0n;
    const sys = custom ? system : "";
    // Sample mode quotes the study's totals for that group; custom mode counts the text here, in the browser.
    const g = custom ? null : group(sample!);
    const chars = g ? BigInt(g.chars) : charCount(text);
    const est = g ? BigInt(g.estimate) : estimate(text, ratioN) + (sys ? estimate(sys, ratioN) : 0n);
    const count = (id: TokenizerId): number | null => {
      if (g) return g.byTokenizer[id].tokens;
      const c = counters[id];
      return typeof c === "function" ? c(text) + (sys ? c(sys) : 0) : null;
    };
    const rows = TOKENIZERS.map((t) => ({ ...t, real: count(t.id), state: counters[t.id] }));
    const counted = rows.filter((x) => x.real !== null && x.real > 0);
    const worst = counted.reduce<{ label: string; v: ReturnType<typeof verdict> } | null>((w, x) => {
      const v = verdict(x.real!, est);
      return !w || v.x > w.v.x ? { label: x.label, v } : w;
    }, null);
    const o = sys ? model.overhead.withSystem : model.overhead.noSystem;
    const modelReal = count(model.tokenizer);
    const billed = modelReal === null ? null : BigInt(modelReal + o.median);
    const costEst = cost({ input: est, output: out, cached: 0n }, rates);
    const costProj = billed === null ? null : cost({ input: billed, output: out, cached: 0n }, rates);
    return { g, chars, est, out, rows, worst, o, billed, costEst, costProj, sys };
  }, [sample, text, system, output, ratio, counters, model, rates, custom]);

  const card = RATE_CARDS.find((c) => c.id === cardId)!;
  const edited = card && (card.rates.input !== rates.input || card.rates.output !== rates.output || card.rates.cached !== rates.cached);
  const tokLabel = (id: TokenizerId) => TOKENIZERS.find((t) => t.id === id)!.label;
  const shortModel = model.model.replace("openai/", "");
  const pickModel = (i: number) => { setModelIx(i); setCardId(MODELS[i].card.id); setRates(MODELS[i].card.rates); reprint(); };

  return (
    <div className="calc">
      <div className="panel fade f3" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <label htmlFor="prompt" className="lab" style={{ display: "block", marginBottom: 8 }}>Prompt</label>
          <textarea
            id="prompt"
            className="field"
            value={custom ? text : `Corpus sample loaded: ${groupLabel(sample!)} (${r.g!.samples} samples), ${fmt(r.g!.chars)} characters.\nType or paste your own prompt to replace it.`}
            onFocus={() => { if (!custom) { setSample(null); setText(""); } }}
            onChange={(e) => { setSample(null); setText(e.target.value); }}
          />
        </div>
        <fieldset>
          <legend className="lab" style={{ marginBottom: 10 }}>Try a corpus sample</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SAMPLES.map((s) => (
              <button key={s} type="button" className={`chip${sample === s ? " on" : ""}`} aria-pressed={sample === s} onClick={() => { setSample(s); reprint(); }}>{groupLabel(s)}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="lab" style={{ marginBottom: 10 }}>Model</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MODELS.map((m, i) => (
              <button key={m.model} type="button" className={`chip${i === modelIx ? " on" : ""}`} aria-pressed={i === modelIx} onClick={() => pickModel(i)}>
                {m.model.replace("openai/", "")} · {m.provider === "groq" ? "Groq" : "Google"}
              </button>
            ))}
          </div>
        </fieldset>
        {custom && (
          <fieldset>
            <legend className="lab" style={{ marginBottom: 10 }}>Tokenizers</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TOKENIZERS.map((t) => {
                const s = counters[t.id];
                return (
                  <button key={t.id} type="button" className={`chip${typeof s === "function" ? " on" : ""}`} disabled={s === "loading"} aria-pressed={typeof s === "function"} onClick={() => load(t.id)}>
                    {t.label}{s === "loading" ? " · loading" : s === "error" ? " · retry" : typeof s === "function" ? " ✓" : t.hf ? " · download" : ""}
                  </button>
                );
              })}
            </div>
            <p className="mut" style={{ fontSize: 13, margin: "8px 0 0" }}>Llama 3.1 and Gemma 3 download from Hugging Face on first use, then stay cached in your browser.</p>
          </fieldset>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <div><div className="lab">Characters</div><div className="mono stat">{fmt(r.chars)}</div></div>
          <div><div className="lab">Estimate · ÷{custom ? digits(ratio, 4n).toString() || "4" : "4"}</div><div className="mono stat">{fmt(r.est)}</div></div>
          <div><div className="lab">Est. cost / 1k req</div><div className="mono stat">{formatUsd(r.costEst * 1000n)}</div></div>
        </div>
        <details>
          <summary className="lab">More options: system prompt, output, ratio, rates</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10 }}>
            {!custom && <p className="mut" style={{ fontSize: 13, margin: 0 }}>System prompt, output tokens and ratio apply to your own text, not to corpus samples.</p>}
            <label className="lab" style={{ display: "block" }}>System prompt
              <textarea className="field" style={{ minHeight: 64, marginTop: 6 }} value={system} disabled={!custom} onChange={(e) => setSystem(e.target.value)} />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <label className="lab">Expected output tokens <input className="field" style={{ width: 120, display: "block", marginTop: 6 }} inputMode="numeric" value={output} disabled={!custom} onChange={(e) => setOutput(e.target.value)} /></label>
              <label className="lab">Characters per token <input className="field" style={{ width: 120, display: "block", marginTop: 6 }} inputMode="numeric" value={ratio} disabled={!custom} onChange={(e) => setRatio(e.target.value)} /></label>
            </div>
            <RateCardPicker cardId={cardId} rates={rates} onChange={(id, x) => { setCardId(id); setRates(x); }} />
          </div>
        </details>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={reprint}>Print receipt</button>
          <span className="mut" style={{ fontSize: 13 }}>Nothing leaves your browser.</span>
        </div>
      </div>

      <div className="fade f4" aria-live="polite">
        <div className="printer">
          <span className="lab">Overrun · TP-01</span>
          <span className="led" aria-hidden="true" />
          <div className="slot" aria-hidden="true" />
        </div>
        <div className="feed">
          <div className="receipt" ref={receipt}>
            <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: ".3em" }}>OVERRUN</div>
            <div className="rmut small" style={{ textAlign: "center" }}>token receipt{today ? ` · ${today}` : ""}</div>
            <div className="hr" />
            <div className="rl"><span>{custom ? "your prompt" : groupLabel(sample!)}</span><span className="d" /><span className="rmut">{custom ? (r.sys ? "+ system prompt" : "pasted") : `study · ${r.g!.samples} samples`}</span></div>
            <div className="rl"><span>characters</span><span className="d" /><span>{fmt(r.chars)}</span></div>
            <div className="hr" />
            <div className="rl"><span>ESTIMATE (chars ÷ {custom ? digits(ratio, 4n).toString() || "4" : "4"})</span><span className="d" /><span>{fmt(r.est)}</span></div>
            <div className="rmut small">an estimate, not a count</div>
            <div className="hr" />
            <div style={{ fontWeight: 700 }}>REAL COUNT · tokens · real÷est</div>
            {r.rows.map((x) => (
              <div className="rl" key={x.id}>
                <span>{x.label}{x.id === model.tokenizer && <b> ← model</b>}</span><span className="d" />
                <span>{x.real !== null ? fmt(x.real) : x.state === "loading" ? "loading" : "not loaded"}</span>
                <span className="rmut" style={{ minWidth: 52, textAlign: "right" }}>{x.real !== null && r.est > 0n ? `×${factor(x.real, r.est).toFixed(2)}` : ""}</span>
              </div>
            ))}
            <div className="hr" />
            <div className="rl"><span>hidden overhead</span><span className="d" /><span>+{r.o.median}</span></div>
            <div className="rmut small">{shortModel}, median of {r.o.n} measured requests, {r.sys ? "with" : "no"} system prompt</div>
            <div className="rl" style={{ fontWeight: 700 }}><span>BILLED INPUT (projected)</span><span className="d" /><span>{r.billed !== null ? fmt(r.billed) : `load ${tokLabel(model.tokenizer)}`}</span></div>
            {model.tokenizer === "gemma3" && <div className="rmut small">Gemini&apos;s tokenizer isn&apos;t public; Gemma 3 stands in for it.</div>}
            <div className="hr" />
            <div className="rl"><span>rate, input / 1M</span><span className="d" /><span>{formatUsd(rates.input * 1_000_000n)}</span></div>
            {r.out > 0n && <div className="rl"><span>+ output, {fmt(r.out)} tokens</span><span className="d" /><span>{formatUsd(rates.output * 1_000_000n)} / 1M</span></div>}
            <div className="rl"><span>cost · estimate</span><span className="d" /><span>{formatUsd(r.costEst)}</span></div>
            <div className="rl" style={{ fontWeight: 700 }}><span>cost · projected</span><span className="d" /><span>{r.costProj !== null ? formatUsd(r.costProj) : "–"}</span></div>
            <div className="rl"><span>per 1,000 requests</span><span className="d" /><span>{formatUsd(r.costEst * 1000n)} → {r.costProj !== null ? formatUsd(r.costProj * 1000n) : "–"}</span></div>
            <div className="rmut small">
              {edited ? "edited rates, based on " : ""}{card.provider} rate card for {card.model}, dated {longDate(card.asOf)} · <a href={card.source}>{host(card.source)}</a>
            </div>
            <div className="hr" />
            {r.billed !== null && r.est > 0n && (() => {
              const v = verdict(Number(r.billed), r.est);
              return <div className="rl"><span>{shortModel} vs estimate</span><span className="d" /><span>{v.dir.toLowerCase()} by {v.x.toFixed(2)}×</span></div>;
            })()}
            <div style={{ textAlign: "center" }}>
              <div className="stamp" ref={stamp}>{r.worst ? `${r.worst.v.dir} BY ${r.worst.v.x.toFixed(2)}×` : "NO COUNT YET"}</div>
              <div className="rmut small" style={{ marginTop: 8 }}>{r.worst ? `worst of ${r.rows.filter((x) => x.real !== null).length} tokenizers · ${r.worst.label}` : "type a prompt to count it"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
