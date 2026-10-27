import Link from "next/link";
import { formatUsd } from "@/lib/pricing";
import { TOKENIZERS } from "@/lib/tokenizers";
import { Calculator } from "./Calculator";
import { DotChart } from "./DotChart";
import { fmt, group, host, longDate, MODELS, study } from "./data";

const STEPS = [
  ["Estimate", "Characters ÷ 4, instantly, and always shown as an estimate."],
  ["Count", "Real tokenizers run locally: o200k, cl100k, Llama 3.1, Gemma 3."],
  ["Validate", "After the call, read the provider’s reported usage and explain the gap."],
  ["Price", "Integer nano-dollars and a rate card with its date and source on show."],
  ["Admit", "Replay against a budget ledger. Requests that would overrun it are blocked."],
];

export default function Home() {
  const w = study.headline.worst;
  const en = study.headline.english;
  const wg = group(w.group);
  const wTok = TOKENIZERS.find((t) => t.label === w.tokenizer || t.id === w.tokenizer)!;
  const groq = MODELS.find((m) => m.provider === "groq")!;
  const h = study.real.heldOut;
  return (
    <>
      <section className="wrap fade" aria-labelledby="hero-h">
        <div className="hero">
          <div className="call c1" style={{ gridColumn: 1, gridRow: 1 }}>
            <b>({w.charsPerToken})</b><span>characters per token: {w.group} on {w.tokenizer}</span><div className="pin" aria-hidden="true" />
          </div>
          <div className="lab toplab" style={{ gridColumn: 2, gridRow: 1, textAlign: "center" }}>
            A study of {study.corpus.samples} samples · {study.tokenizers.length} tokenizers · {study.real.requests} real requests
          </div>
          <div className="call c3" style={{ gridColumn: 3, gridRow: 1, alignItems: "flex-end", textAlign: "right" }}>
            <b>({en.charsPerToken})</b><span>characters per token: English on {en.tokenizer}</span><div className="pin" aria-hidden="true" />
          </div>
          <div className="ctr">
            <div className="big" aria-label={`${w.factor} times`}>{w.factor}<sup>×</sup></div>
            <h1 id="hero-h" className="serif">How far &ldquo;four characters per token&rdquo; <em>undercounts</em> {w.group}.</h1>
            <p className="mono mut" style={{ margin: 0, fontSize: 12, maxWidth: 560 }}>
              Estimate {fmt(wg.estimate)} tokens · real {fmt(w.tokens)} on {w.tokenizer} ({wTok.usedBy}) · {wg.samples} {wg.kind === "prose" ? "NTREX-128 sentences" : "samples"}, {fmt(wg.chars)} characters
            </p>
          </div>
          <div className="call c4" style={{ gridColumn: 1, gridRow: 3, justifyContent: "flex-end" }}>
            <div className="pin" aria-hidden="true" /><b>(+{groq.overhead.noSystem.median})</b><span>hidden input tokens per request: {groq.model.replace("openai/", "")} on Groq, measured</span>
          </div>
          <div className="cta" style={{ gridColumn: 2, gridRow: 3, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="#calc">Estimate a request</a>
            <Link className="pill" href="/findings/" style={{ minHeight: 48, padding: "0 20px" }}>Read the findings →</Link>
          </div>
          <div className="call c5" style={{ gridColumn: 3, gridRow: 3, alignItems: "flex-end", textAlign: "right", justifyContent: "flex-end" }}>
            <div className="pin" aria-hidden="true" /><b>({h.explainedPct}%)</b><span>of the estimate gap explained on {h.heldOut.length} held-out requests</span>
          </div>
        </div>
      </section>

      <section id="calc" className="wrap sec" aria-labelledby="calc-h">
        <div className="fade f2" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
          <div>
            <div className="lab">02 · The calculator</div>
            <h2 id="calc-h" className="serif h1">Estimate it. Then <em>print the truth.</em></h2>
          </div>
          <p className="mut" style={{ margin: 0, maxWidth: 380 }}>
            The estimate is labelled as one. The receipt counts with real tokenizers, adds the hidden per-request overhead we measured, and prices it with a dated rate card.
          </p>
        </div>
        <Calculator />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, marginTop: 40 }}>
          {MODELS.map(({ card }) => (
            <div className="rate" key={card.id}>
              <span className="lab">Rate card · {card.provider} · dated {longDate(card.asOf)}</span>
              <span className="mono" style={{ fontSize: 14 }}>{card.model} · {formatUsd(card.rates.input * 1_000_000n)} in · {formatUsd(card.rates.output * 1_000_000n)} out / 1M tokens</span>
              <a className="mono mut" style={{ fontSize: 12, overflowWrap: "anywhere" }} href={card.source}>{host(card.source)}{new URL(card.source).pathname}</a>
            </div>
          ))}
          <div className="rate">
            <span className="lab">Note</span>
            <span className="mut" style={{ fontSize: 13 }}>Gemini&apos;s tokenizer isn&apos;t public; Gemma 3, its closest open relative, stands in for the count. Rate cards are dated fixtures, not current prices.</span>
          </div>
        </div>
      </section>

      <section className="wrap sec" aria-labelledby="how-h">
        <div className="lab">03 · How it works</div>
        <h2 id="how-h" className="serif h2" style={{ marginBottom: 32 }}>Five steps, <em>before and after</em> you send.</h2>
        <ol className="how">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <div className="mono acc" style={{ fontSize: 13 }}>0{i + 1}</div>
              <div className="serif" style={{ fontSize: 32, margin: "6px 0" }}>{t}</div>
              <p className="mut" style={{ margin: 0, fontSize: 14 }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap sec end" aria-labelledby="f-h">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <div className="lab">04 · Findings</div>
            <h2 id="f-h" className="serif h2">Characters per token, <em>by what you write.</em></h2>
          </div>
          <Link className="pill" href="/findings/">All four tokenizers →</Link>
        </div>
        <DotChart tokenizers={["o200k_base", "cl100k_base"]} />
        <p className="mono mut" style={{ fontSize: 11, margin: "18px 0 0" }}>
          Corpus built {longDate(study.corpus.built)} · {study.corpus.samples} samples · NTREX-128 (CC BY-SA 4.0), MIT-licensed code and docs, synthetic samples (MIT). Counts exclude special tokens.
        </p>
      </section>
    </>
  );
}
