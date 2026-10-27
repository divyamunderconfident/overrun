"use client";
import { RATE_CARDS } from "@/lib/ratecards";
import type { Rates } from "@/lib/pricing";
import { host, longDate } from "./data";

/** Pick a dated rate card, then edit its integer nano-dollar rates. */
export function RateCardPicker({ cardId, rates, onChange }: { cardId: string; rates: Rates; onChange: (cardId: string, rates: Rates) => void }) {
  const card = RATE_CARDS.find((c) => c.id === cardId);
  const set = (k: keyof Rates, v: string) => /^\d+$/.test(v) && onChange(cardId, { ...rates, [k]: BigInt(v) });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="lab" style={{ display: "block" }}>
        Rate card
        <select className="field" style={{ display: "block", marginTop: 6 }} value={cardId} onChange={(e) => onChange(e.target.value, RATE_CARDS.find((c) => c.id === e.target.value)!.rates)}>
          {RATE_CARDS.map((c) => <option key={c.id} value={c.id}>{c.provider} / {c.model} · {c.asOf}</option>)}
        </select>
      </label>
      {card && (
        <p className="mut" style={{ fontSize: 13, margin: 0 }}>
          Dated {longDate(card.asOf)}, from <a href={card.source}>{host(card.source)}</a>. A fixture, not a current price.{card.note ? ` Note: ${card.note}.` : ""}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {(["input", "cached", "output"] as const).map((k) => (
          <label key={k} className="lab">
            {k} · nano-$/token
            <input className="field num" style={{ width: 130, display: "block", marginTop: 6 }} inputMode="numeric" value={rates[k].toString()} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}
