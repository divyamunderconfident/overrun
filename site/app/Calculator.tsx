"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUsd, type Rates } from "@/lib/pricing";
import { loadTokenizer, TOKENIZERS, type Counter, type TokenizerId } from "@/lib/tokenizers";
import { fmt, group, groupLabel, MODELS } from "./data";
import { RateCardPicker } from "./RateCardPicker";
import { computeReceipt, Receipt } from "./Receipt";
import { Term, Tip } from "./Tip";

const SAMPLES = ["English", "Hindi", "Tamil", "Chinese", "code", "json"];
const AUTO: TokenizerId[] = ["o200k_base", "cl100k_base"]; // bundled with the page, loaded on first use without asking
const HINT_KEY = "overrun-hint-dismissed";
const digits = (v: string, fallback: bigint) => (/^\d+$/.test(v) ? BigInt(v) : fallback);

function FirstVisitHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(HINT_KEY) !== "1"); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(HINT_KEY, "1"); } catch {}
  };
  return (
    <div className="hint" role="note">
      <span>First time? Pick a sample, then press <b>Print receipt</b>. Hover any <span className="tip" aria-hidden="true" style={{ cursor: "default" }}>?</span> to learn a word.</span>
      <button type="button" className="chip" style={{ flex: "none" }} onClick={dismiss} aria-label="Dismiss this hint">Got it</button>
    </div>
  );
}

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

  // The receipt slides out of the printer, then the stamp lands. Skipped entirely under reduced motion.
  function reprint() {
    const el = receipt.current;
    if (!el?.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: "translateY(-100%)" }, { transform: "translateY(0)" }], { duration: 1700, easing: "steps(22, end)" });
    el.querySelector(".stamp")?.animate(
      [{ opacity: 0, transform: "rotate(-5deg) scale(1.6)" }, { opacity: 1, transform: "rotate(-5deg) scale(1)" }],
      { duration: 350, delay: 1750, fill: "backwards", easing: "cubic-bezier(.2,1.4,.4,1)" },
    );
  }

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
    reprint();
  }, []);
  useEffect(() => { if (custom) AUTO.forEach(load); }, [custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratioN = digits(ratio, 4n) || 4n;
  const r = useMemo(
    () => computeReceipt({ group: custom ? null : group(sample!), text, system, ratio: ratioN, out: custom ? digits(output, 0n) : 0n, counters, model, cardId, rates }),
    [sample, text, system, output, ratioN, counters, model, cardId, rates, custom],
  );
  const g = custom ? null : group(sample!);
  const pickModel = (i: number) => { setModelIx(i); setCardId(MODELS[i].card.id); setRates(MODELS[i].card.rates); reprint(); };

  return (
    <div className="calc">
      <div className="panel fade f3" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <FirstVisitHint />
        <div>
          <span style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <label htmlFor="prompt" className="lab">Prompt</label><Tip id="prompt" />
          </span>
          <textarea
            id="prompt"
            className="field"
            value={custom ? text : `Corpus sample loaded: ${groupLabel(sample!)} (${g!.samples} samples), ${fmt(g!.chars)} characters.\nType or paste your own prompt to replace it.`}
            onFocus={() => { if (!custom) { setSample(null); setText(""); } }}
            onChange={(e) => { setSample(null); setText(e.target.value); }}
          />
        </div>
        <fieldset>
          <legend className="lab" style={{ marginBottom: 10 }}><Term id="corpus">Try a corpus sample</Term></legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SAMPLES.map((s) => (
              <button key={s} type="button" className={`chip${sample === s ? " on" : ""}`} aria-pressed={sample === s} onClick={() => { setSample(s); reprint(); }}>{groupLabel(s)}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="lab" style={{ marginBottom: 10 }}><Term id="ai-model">Model</Term></legend>
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
            <legend className="lab" style={{ marginBottom: 10 }}><Term id="tokenizer">Tokenizers</Term></legend>
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
            <p className="mut" style={{ fontSize: 13, margin: "8px 0 0" }}>Llama 3.1 and Gemma 3 download from Hugging Face the first time you choose them.</p>
          </fieldset>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <div><div className="lab"><Term id="characters">Characters</Term></div><div className="mono stat">{fmt(r.chars)}</div></div>
          <div><div className="lab"><Term id="estimate">Estimate · ÷{r.ratio.toString()}</Term></div><div className="mono stat">{fmt(r.est)}</div></div>
          <div><div className="lab">Est. cost / 1k req</div><div className="mono stat">{formatUsd(r.costEst * 1000n)}</div></div>
        </div>
        <details>
          <summary className="lab">More options: system prompt, output, ratio, rates</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10 }}>
            {!custom && <p className="mut" style={{ fontSize: 13, margin: 0 }}>System prompt, output tokens and ratio apply to your own text, not to corpus samples.</p>}
            <div>
              <span style={{ display: "flex", alignItems: "center" }}><label htmlFor="system" className="lab">System prompt</label><Tip id="system-prompt" /></span>
              <textarea id="system" className="field" style={{ minHeight: 64, marginTop: 6 }} value={system} disabled={!custom} onChange={(e) => setSystem(e.target.value)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <div>
                <span style={{ display: "flex", alignItems: "center" }}><label htmlFor="out" className="lab">Expected output tokens</label><Tip id="input-output" /></span>
                <input id="out" className="field num" style={{ width: 120, marginTop: 6 }} inputMode="numeric" value={output} disabled={!custom} onChange={(e) => setOutput(e.target.value)} />
              </div>
              <div>
                <span style={{ display: "flex", alignItems: "center" }}><label htmlFor="ratio" className="lab">Characters per token</label><Tip id="four-char-rule" /></span>
                <input id="ratio" className="field num" style={{ width: 120, marginTop: 6 }} inputMode="numeric" value={ratio} disabled={!custom} onChange={(e) => setRatio(e.target.value)} />
              </div>
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
          <Receipt ref={receipt} r={r} date={today} />
        </div>
      </div>
    </div>
  );
}
