import { groupLabel, groups } from "./data";
import { TOKENIZERS, type TokenizerId } from "@/lib/tokenizers";

const MAX = 5; // chars/token axis: 0..5, the 4.0 rule at 80%

/** Characters per token, one row per kind of text, one dot per tokenizer. */
export function DotChart({ tokenizers }: { tokenizers: TokenizerId[] }) {
  const labels = tokenizers.map((t) => TOKENIZERS.find((x) => x.id === t)!.label);
  const desc = groups.map((g) => `${groupLabel(g.group)}: ${tokenizers.map((t, i) => `${labels[i]} ${g.byTokenizer[t].charsPerToken}`).join(", ")}`).join("; ");
  return (
    <figure style={{ margin: 0 }}>
      <div className="mono" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", fontSize: 12, marginBottom: 14 }}>
        {tokenizers.map((t, i) => (
          <span key={t} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><span className={`dot key ${t}`} aria-hidden="true" />{labels[i]}</span>
        ))}
        <span className="acc">┆ the 4.0 rule</span>
      </div>
      <div role="img" aria-label={`Characters per token. ${desc}.`}>
        <div className="dotrow" style={{ borderBottom: "1px solid var(--ink)" }}>
          <span className="lab">Text</span>
          <span className="lab" style={{ position: "relative", height: 16 }}>
            {[0, 1, 2, 3, 4].map((n) => <span key={n} style={{ position: "absolute", left: `${(n / MAX) * 100}%`, transform: n ? "translateX(-50%)" : undefined }}>{n}</span>)}
            <span style={{ position: "absolute", right: 0 }}>5 chars/token</span>
          </span>
          <span className="lab vals" style={{ textAlign: "right" }}>{labels.join(" · ")}</span>
        </div>
        {groups.map((g) => (
          <div className="dotrow" key={g.group}>
            <span style={{ fontSize: 14 }}>{groupLabel(g.group)}</span>
            <div className="track">
              <div className="rule" style={{ left: `${(4 / MAX) * 100}%` }} />
              {tokenizers.map((t) => <span key={t} className={`dot ${t}`} style={{ left: `${(Math.min(g.byTokenizer[t].charsPerToken, MAX) / MAX) * 100}%` }} />)}
            </div>
            <span className="mono vals" style={{ textAlign: "right", fontSize: 13 }}>{tokenizers.map((t) => g.byTokenizer[t].charsPerToken.toFixed(2)).join(" · ")}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
