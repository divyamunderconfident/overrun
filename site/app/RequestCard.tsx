import { formatUsd } from "@/lib/pricing";
import type { reconcileOne } from "@/lib/reconcile";

/** One request as a small receipt: estimate, the input-side reasons, actual input, cost-only reasons, costs, and the ledger stamp. */
export function RequestCard({ r, status }: { r: ReturnType<typeof reconcileOne>; status: string }) {
  return (
    <article className="card" aria-label={`${r.id}, ${status}`}>
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
        <span className={`stamp sm${status === "settled" ? " ok" : ""}`}>{status.toUpperCase()}</span>
      </div>
    </article>
  );
}
