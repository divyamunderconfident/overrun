"use client";
import { RATE_CARDS } from "@/lib/ratecards";
import type { Rates } from "@/lib/pricing";

/** Pick a dated rate card, then edit its integer nano-dollar rates. */
export function RateCardPicker({ cardId, rates, onChange }: { cardId: string; rates: Rates; onChange: (cardId: string, rates: Rates) => void }) {
  const card = RATE_CARDS.find((c) => c.id === cardId);
  const set = (k: keyof Rates, v: string) => /^\d+$/.test(v) && onChange(cardId, { ...rates, [k]: BigInt(v) });
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        Rate card{" "}
        <select value={cardId} onChange={(e) => onChange(e.target.value, RATE_CARDS.find((c) => c.id === e.target.value)!.rates)}>
          {RATE_CARDS.map((c) => <option key={c.id} value={c.id}>{c.provider} / {c.model}</option>)}
        </select>
      </label>
      {card && (
        <p className="text-xs text-zinc-500">
          Fixture dated {card.asOf}, from <a href={card.source}>{new URL(card.source).host}</a>. Not a current price.{card.note ? ` Note: ${card.note}.` : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {(["input", "cached", "output"] as const).map((k) => (
          <label key={k}>
            {k} <input className="w-24" inputMode="numeric" value={rates[k].toString()} onChange={(e) => set(k, e.target.value)} /> nano-$/token
          </label>
        ))}
      </div>
    </div>
  );
}
