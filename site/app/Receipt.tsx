import { charCount, estimate } from "@/lib/estimate";
import { cost, formatUsd, type Rates } from "@/lib/pricing";
import { RATE_CARDS } from "@/lib/ratecards";
import { TOKENIZERS, type Counter, type TokenizerId } from "@/lib/tokenizers";
import { fmt, groupLabel, host, longDate, type Group, type Model } from "./data";
import { Tip } from "./Tip";

export const factor = (real: number, est: bigint) => (est > 0n ? real / Number(est) : 0);
export const verdict = (real: number, est: bigint) => {
  const f = factor(real, est);
  return f >= 1 ? { dir: "UNDER", x: f } : { dir: "OVER", x: f > 0 ? 1 / f : 0 };
};

type Input = {
  group: Group | null; // a corpus sample (study totals), or null for the user's own text
  text: string;
  system: string;
  ratio: bigint;
  out: bigint;
  counters: Partial<Record<TokenizerId, Counter | "loading" | "error">>;
  model: Model;
  cardId: string;
  rates: Rates;
};

/** Everything the receipt prints, computed from the study totals or from the user's text. */
export function computeReceipt({ group: g, text, system, ratio, out, counters, model, cardId, rates }: Input) {
  const sys = g ? "" : system;
  const chars = g ? BigInt(g.chars) : charCount(text);
  const est = g ? BigInt(g.estimate) : estimate(text, ratio) + (sys ? estimate(sys, ratio) : 0n);
  const count = (id: TokenizerId): number | null => {
    if (g) return g.byTokenizer[id].tokens;
    const c = counters[id];
    return typeof c === "function" ? c(text) + (sys ? c(sys) : 0) : null;
  };
  const rows = TOKENIZERS.map((t) => ({ id: t.id, label: t.label, real: count(t.id), state: counters[t.id], isModel: t.id === model.tokenizer }));
  const counted = rows.filter((x) => x.real !== null && x.real > 0);
  const worst = counted.reduce<{ label: string; v: ReturnType<typeof verdict> } | null>((w, x) => {
    const v = verdict(x.real!, est);
    return !w || v.x > w.v.x ? { label: x.label, v } : w;
  }, null);
  const o = sys ? model.overhead.withSystem : model.overhead.noSystem;
  const modelReal = count(model.tokenizer);
  const billed = modelReal === null ? null : BigInt(modelReal + o.median);
  const card = RATE_CARDS.find((c) => c.id === cardId)!;
  const edited = card.rates.input !== rates.input || card.rates.output !== rates.output || card.rates.cached !== rates.cached;
  return {
    title: g ? groupLabel(g.group) : "your prompt",
    sub: g ? `study · ${g.samples} samples` : sys ? "+ system prompt" : "pasted",
    chars, est, ratio: g ? 4n : ratio, out, rows, worst, counted: counted.length, o, sys, billed, model, card, edited, rates,
    costEst: cost({ input: est, output: out, cached: 0n }, rates),
    costProj: billed === null ? null : cost({ input: billed, output: out, cached: 0n }, rates),
  };
}
export type ReceiptData = ReturnType<typeof computeReceipt>;

/** Numbered callouts used by the annotated receipt on /start. */
const M = ({ n, on }: { n: number; on?: boolean }) => (on ? <span className="mark" aria-label={`note ${n}`}>{n}</span> : null);

export function Receipt({ r, date, marks, ref }: { r: ReceiptData; date: string; marks?: boolean; ref?: React.Ref<HTMLDivElement> }) {
  const tokLabel = TOKENIZERS.find((t) => t.id === r.model.tokenizer)!.label;
  const shortModel = r.model.model.replace("openai/", "");
  return (
    <div className="receipt" ref={ref}>
      <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: ".3em" }}>OVERRUN</div>
      <div className="rmut small" style={{ textAlign: "center" }}>token receipt{date ? ` · ${date}` : ""}</div>
      <div className="hr" />
      <div className="rl"><span>{r.title}</span><span className="d" /><span className="rmut">{r.sub}</span></div>
      <div className="rl"><span>characters<Tip id="characters" /></span><span className="d" /><span>{fmt(r.chars)}</span></div>
      <div className="hr" />
      <div className="rl"><span>ESTIMATE (chars ÷ {r.ratio.toString()})<Tip id="estimate" /><M n={1} on={marks} /></span><span className="d" /><span>{fmt(r.est)}</span></div>
      <div className="rmut small">an estimate, not a count</div>
      <div className="hr" />
      <div style={{ fontWeight: 700 }}>REAL COUNT · tokens · real÷est<Tip id="tokenizer" /><M n={2} on={marks} /></div>
      {r.rows.map((x) => (
        <div className="rl" key={x.id}>
          <span>{x.label}{x.isModel && <b> ← model</b>}</span><span className="d" />
          <span>{x.real !== null ? fmt(x.real) : x.state === "loading" ? "loading" : "not loaded"}</span>
          <span className="rmut" style={{ minWidth: 52, textAlign: "right" }}>{x.real !== null && r.est > 0n ? `×${factor(x.real, r.est).toFixed(2)}` : ""}</span>
        </div>
      ))}
      <div className="hr" />
      <div className="rl"><span>hidden overhead<Tip id="overhead" /><M n={3} on={marks} /></span><span className="d" /><span>+{r.o.median}</span></div>
      <div className="rmut small">{shortModel}, median<Tip id="median" /> of {r.o.n} measured requests, {r.sys ? "with" : "no"} system prompt</div>
      <div className="rl" style={{ fontWeight: 700 }}><span>BILLED INPUT (projected)<Tip id="input-output" /><M n={4} on={marks} /></span><span className="d" /><span>{r.billed !== null ? fmt(r.billed) : `load ${tokLabel}`}</span></div>
      {r.model.tokenizer === "gemma3" && <div className="rmut small">Gemini&apos;s tokenizer isn&apos;t public; Gemma 3 stands in for it.</div>}
      <div className="hr" />
      <div className="rl"><span>rate, input / 1M<Tip id="rate-card" /></span><span className="d" /><span>{formatUsd(r.rates.input * 1_000_000n)}</span></div>
      {r.out > 0n && <div className="rl"><span>+ output, {fmt(r.out)} tokens</span><span className="d" /><span>{formatUsd(r.rates.output * 1_000_000n)} / 1M</span></div>}
      <div className="rl"><span>cost · estimate<M n={5} on={marks} /></span><span className="d" /><span>{formatUsd(r.costEst)}</span></div>
      <div className="rl" style={{ fontWeight: 700 }}><span>cost · projected</span><span className="d" /><span>{r.costProj !== null ? formatUsd(r.costProj) : "–"}</span></div>
      <div className="rl"><span>per 1,000 requests</span><span className="d" /><span>{formatUsd(r.costEst * 1000n)} → {r.costProj !== null ? formatUsd(r.costProj * 1000n) : "–"}</span></div>
      <div className="rmut small">
        {r.edited ? "edited rates, based on " : ""}{r.card.provider} rate card for {r.card.model}, dated {longDate(r.card.asOf)} · <a href={r.card.source}>{host(r.card.source)}</a>
      </div>
      <div className="hr" />
      {r.billed !== null && r.est > 0n && (() => {
        const v = verdict(Number(r.billed), r.est);
        return <div className="rl"><span>{shortModel} vs estimate</span><span className="d" /><span>{v.dir.toLowerCase()} by {v.x.toFixed(2)}×</span></div>;
      })()}
      <div style={{ textAlign: "center" }}>
        <div className="stamp">{r.worst ? `${r.worst.v.dir} BY ${r.worst.v.x.toFixed(2)}×` : "NO COUNT YET"}</div><M n={6} on={marks} />
        <div className="rmut small" style={{ marginTop: 8 }}>{r.worst ? `worst of ${r.counted} tokenizers · ${r.worst.label}` : "type a prompt to count it"}</div>
      </div>
    </div>
  );
}
