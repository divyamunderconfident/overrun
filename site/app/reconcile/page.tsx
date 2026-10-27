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
  const loadDemo = () => fetch("/data/demo-log.json").then((r) => r.json()).then((l) => use(l, "demo")).catch((e) => setError(String(e)));
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

  const rateLabel = `${RATE_CARDS.find((c) => c.id === cardId)?.model ?? "custom"} (input ${rates.input}, cached ${rates.cached}, output ${rates.output} nano-$/token)`;

  return (
    <div className="space-y-4">
      <h1>Reconcile estimate vs actual</h1>
      <p className="text-sm text-zinc-500">
        Showing: <b>{source === "demo" ? "demo log (50 real free-tier requests recorded by the study)" : source}</b>.{" "}
        Upload your own log in the same JSON shape as <a href="/data/demo-log.json">the demo log</a>. It stays in your browser.
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button onClick={loadDemo}>Load demo log</button>
        <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <RateCardPicker cardId={cardId} rates={rates} onChange={(id, x) => { setCardId(id); setRates(x); }} />
      <label className="block text-sm">Budget <input className="w-32" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} /> nano-dollars ({/^\d+$/.test(budget) ? formatUsd(BigInt(budget)) : "invalid"})</label>

      {result && "error" in result && <p className="text-sm text-red-600">Invalid log: {result.error}</p>}
      {result && "report" in result && result.report && (() => {
        const { report, ledger, held } = result;
        const t = report.totals;
        const blocked = ledger.settlements.filter((s) => s.status === "blocked");
        return (
          <>
            <h2>Summary</h2>
            <ul className="list-disc pl-5 text-sm">
              <li>Estimated input cost (<b>estimate</b>, ceil(characters / 4) on the user prompt): {formatUsd(t.estimateCost)}</li>
              <li>Actual cost from reported usage: {formatUsd(t.actualCost)}</li>
              {held ? (
                <li>
                  Input-token gap explained by named reasons, <b>held-out half</b>: <b>{formatBp(held.explainedBp)}</b> ({held.unexplainedTokens.toString()} of {held.gapTokens.toString()} tokens unexplained)
                  <div className="text-xs text-zinc-500">The chat-format overhead was measured on a fixed random half of the requests; this figure covers only the other {log!.heldOut!.length}. All rows: {formatBp(t.explainedBp)}.</div>
                </li>
              ) : (
                <li>Input-token gap explained by named reasons: <b>{formatBp(t.explainedBp)}</b> ({t.unexplainedTokens.toString()} of {t.gapTokens.toString()} tokens unexplained)</li>
              )}
              <li>Ledger: spent {formatUsd(ledger.spent)} of {formatUsd(ledger.limit)}; {blocked.length} request(s) would have been blocked{blocked.length ? `: ${blocked.map((b) => b.id).join(", ")}` : ""}.</li>
            </ul>
            <div className="flex gap-3">
              <button onClick={() => download("overrun-report.csv", toCsv(report), "text/csv")}>Export CSV</button>
              <button onClick={() => download("overrun-report.md", toMarkdown(report, rateLabel), "text/markdown")}>Export Markdown</button>
            </div>

            <h2>Per request</h2>
            <div className="overflow-x-auto">
              <table>
                <thead><tr><th>Request</th><th>Estimate → actual input</th><th>Cost (estimate → actual)</th><th>Why the gap (tokens)</th><th>Ledger</th></tr></thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={r.id}>
                      <td>{r.id}<div className="text-xs text-zinc-500">{r.model}</div></td>
                      <td>{r.estimateTokens.toString()} → {r.actual.input.toString()}<div className="text-xs text-zinc-500">out {r.actual.output.toString()}, cached {r.actual.cached.toString()}</div></td>
                      <td>{formatUsd(r.estimateCost)} → {formatUsd(r.actualCost)}</td>
                      <td className="text-xs">{r.reasons.filter((x) => x.tokens !== 0n).map((x) => <div key={x.reason}>{x.tokens > 0n ? "+" : ""}{x.tokens.toString()} {x.reason}</div>)}</td>
                      <td className="text-xs">{ledger.settlements[i]?.status ?? "not reached"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}
    </div>
  );
}
