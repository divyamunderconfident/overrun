"use client";
import { useEffect, useMemo, useState } from "react";
import { estimate } from "@/lib/estimate";
import { replay } from "@/lib/ledger";
import { formatUsd, type Rates } from "@/lib/pricing";
import { RATE_CARDS } from "@/lib/ratecards";
import { formatBp, reconcile, toCsv, toMarkdown, type UsageLog } from "@/lib/reconcile";
import { loadTokenizer } from "@/lib/tokenizers";
import { RateCardPicker } from "../RateCardPicker";

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// shortcut: uploaded rows without local counts are counted with o200k_base, whatever the model; add a per-model choice if needed.
async function fillLocalCounts(log: UsageLog): Promise<UsageLog> {
  if (log.requests.every((r) => r.local)) return log;
  const n = await loadTokenizer("o200k_base");
  return { ...log, requests: log.requests.map((r) => r.local ? r : { ...r, local: { tokenizer: "o200k_base", prompt: n(r.prompt ?? ""), system: n(r.system ?? "") } }) };
}

export default function Reconcile() {
  const [log, setLog] = useState<UsageLog | null>(null);
  const [source, setSource] = useState("demo");
  const [error, setError] = useState("");
  const [cardId, setCardId] = useState("groq-gpt-oss-20b");
  const [rates, setRates] = useState<Rates>(RATE_CARDS.find((c) => c.id === "groq-gpt-oss-20b")!.rates);
  const [budget, setBudget] = useState("");

  function use(l: UsageLog, name: string) {
    setLog(l);
    setSource(name);
    setBudget(String(l.limit ?? 1000000));
    const card = RATE_CARDS.find((c) => c.id === l.rateCard);
    if (card) { setCardId(card.id); setRates(card.rates); }
  }
  const loadDemo = () => fetch("/data/demo-log.json").then((r) => r.json()).then((l) => { setError(""); use(l, "demo"); }).catch((e) => setError(String(e)));
  useEffect(() => { loadDemo(); }, []);

  async function upload(file: File) {
    setError("");
    try {
      const l = JSON.parse(await file.text()) as UsageLog;
      if (!Array.isArray(l.requests)) throw new Error("expected { requests: [...] }");
      use(await fillLocalCounts(l), file.name);
    } catch (e) {
      setError(`Could not read ${file.name}: ${(e as Error).message}`);
    }
  }

  const result = useMemo(() => {
    if (!log) return null;
    try {
      const report = reconcile(log, rates);
      const ledger = replay({
        limit: /^\d+$/.test(budget) ? BigInt(budget) : 0n,
        rates,
        requests: log.requests.map((r) => ({ id: r.id, estimate: { input_tokens: Number(estimate(r.prompt, 4n)), output_limit: r.output_limit }, usage: r.usage })),
      });
      const held = log.heldOut ? reconcile({ ...log, requests: log.requests.filter((r) => log.heldOut!.includes(r.id)) }, rates).totals : null;
      return { report, ledger, held };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [log, rates, budget]);

  const card = RATE_CARDS.find((c) => c.id === cardId);
  const rateLabel = `${card?.model ?? "custom"} (input ${rates.input}, cached ${rates.cached}, output ${rates.output} nano-$/token${card ? `; rate card dated ${card.asOf}, source ${card.source}` : ""})`;

  return (
    <>
      <section className="wrap fade" aria-labelledby="r-h">
        <div className="lab">Reconcile · estimate vs actual</div>
        <h1 id="r-h" className="serif h1" style={{ maxWidth: 900 }}>Why the bill <em>wasn&apos;t the estimate,</em> request by request.</h1>
        <p className="mut" style={{ maxWidth: 720, marginTop: 20 }}>
          Showing <b style={{ color: "var(--ink)" }}>{source === "demo" ? "the demo log: 50 real free-tier requests recorded by the study" : source}</b>.
          Upload your own log in the same JSON shape as <a href="/data/demo-log.json">the demo log</a>; it never leaves your browser.
        </p>
      </section>

      <section className="wrap" style={{ paddingTop: 40 }}>
        <div className="panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span className="lab">Usage log</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button type="button" className={`chip${source === "demo" ? " on" : ""}`} aria-pressed={source === "demo"} onClick={loadDemo}>Demo log</button>
              <label className="chip" style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
                Upload JSON
                <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
            {error && <p role="alert" style={{ color: "var(--acc)", margin: 0, fontSize: 14 }}>{error}</p>}
            <label className="lab" style={{ display: "block" }}>
              Budget · nano-dollars
              <input className="field num" style={{ display: "block", marginTop: 6, maxWidth: 220 }} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
            <span className="mono mut" style={{ fontSize: 13 }}>= {/^\d+$/.test(budget) ? formatUsd(BigInt(budget)) : "invalid"}</span>
          </div>
          <RateCardPicker cardId={cardId} rates={rates} onChange={(id, x) => { setCardId(id); setRates(x); }} />
        </div>
      </section>

      {result && "error" in result && <section className="wrap" style={{ paddingTop: 24 }}><p role="alert" style={{ color: "var(--acc)" }}>Invalid log: {result.error}</p></section>}
      {result && "report" in result && result.report && (() => {
        const { report, ledger, held } = result;
        const t = report.totals;
        const blocked = ledger.settlements.filter((s) => s.status === "blocked");
        const status = new Map(ledger.settlements.map((s) => [s.id, s.status]));
        const stats: [string, string, string][] = [
          ["Estimated cost · estimate", formatUsd(t.estimateCost), "ceil(characters ÷ 4) on each user prompt"],
          ["Actual cost · reported usage", formatUsd(t.actualCost), `${report.rows.length} requests`],
          held
            ? ["Gap explained · held-out", formatBp(held.explainedBp), `${held.unexplainedTokens} of ${held.gapTokens} tokens unexplained; all rows ${formatBp(t.explainedBp)}`]
            : ["Gap explained", formatBp(t.explainedBp), `${t.unexplainedTokens} of ${t.gapTokens} tokens unexplained`],
          ["Ledger · blocked", String(blocked.length), `spent ${formatUsd(ledger.spent)} of ${formatUsd(ledger.limit)}`],
        ];
        return (
          <>
            <section className="wrap sec" aria-labelledby="s-h">
              <div className="lab">01 · Summary</div>
              <h2 id="s-h" className="serif h2" style={{ marginBottom: 28 }}>The gap, <em>itemised.</em></h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
                {stats.map(([l, v, sub]) => (
                  <div className="rate" key={l}>
                    <span className="lab">{l}</span>
                    <span className="mono stat">{v}</span>
                    <span className="mut" style={{ fontSize: 13 }}>{sub}</span>
                  </div>
                ))}
              </div>
              {held && <p className="mut" style={{ fontSize: 13, maxWidth: 760 }}>The chat-format overhead was measured on a fixed random half of these requests; the held-out figure covers only the other {log!.heldOut!.length}.</p>}
              {blocked.length > 0 && <p style={{ fontSize: 14 }}>Blocked by the ledger (the quote would push spending past the budget): <span className="mono">{blocked.map((b) => b.id).join(", ")}</span></p>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                <button type="button" className="btn" onClick={() => download("overrun-report.csv", toCsv(report), "text/csv")}>Export CSV</button>
                <button type="button" className="pill" style={{ minHeight: 48, padding: "0 20px" }} onClick={() => download("overrun-report.md", toMarkdown(report, rateLabel), "text/markdown")}>Export Markdown</button>
              </div>
            </section>

            <section className="wrap sec end" aria-labelledby="p-h">
              <div className="lab">02 · Per request</div>
              <h2 id="p-h" className="serif h2" style={{ marginBottom: 28 }}>Estimate in, <em>receipt out.</em></h2>
              <div className="cards">
                {report.rows.map((r) => {
                  const st = status.get(r.id) ?? "not reached";
                  return (
                    <article className="card" key={r.id} aria-label={`${r.id}, ${st}`}>
                      <div className="rl" style={{ fontWeight: 700 }}><span>{r.id}</span><span className="d" /><span className="rmut" style={{ fontWeight: 400 }}>{r.model.replace("openai/", "")}</span></div>
                      <div className="hr" />
                      <div className="rl"><span>estimate (chars ÷ 4)</span><span className="d" /><span>{r.estimateTokens.toString()}</span></div>
                      {r.reasons.filter((x) => x.input && x.tokens !== 0n).map((x) => (
                        <div className="rl" key={x.reason}><span className="rmut">{x.reason}</span><span className="d" /><span>{x.tokens > 0n ? "+" : ""}{x.tokens.toString()}</span></div>
                      ))}
                      <div className="rl" style={{ fontWeight: 700 }}><span>actual input</span><span className="d" /><span>{r.actual.input.toString()}</span></div>
                      <div className="hr" />
                      {r.reasons.filter((x) => !x.input && x.tokens !== 0n).map((x) => (
                        <div className="rl" key={x.reason}><span className="rmut">{x.reason}</span><span className="d" /><span>{x.tokens > 0n ? "+" : ""}{x.tokens.toString()} · {formatUsd(x.cost)}</span></div>
                      ))}
                      <div className="rl"><span>cost · estimate</span><span className="d" /><span>{formatUsd(r.estimateCost)}</span></div>
                      <div className="rl" style={{ fontWeight: 700 }}><span>cost · actual</span><span className="d" /><span>{formatUsd(r.actualCost)}</span></div>
                      <div style={{ textAlign: "right", marginTop: 10 }}>
                        <span className={`stamp sm${st === "settled" ? " ok" : ""}`}>{st.toUpperCase()}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        );
      })()}
    </>
  );
}
