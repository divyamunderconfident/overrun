import study from "@/public/data/study.json";

type Range = { median: number; min: number; max: number; n: number } | null | undefined;
const range = (o: Range) => (o ? `${o.median} (${o.min}–${o.max})` : "n/a");

export default function Findings() {
  const w = study.headline.worst;
  const en = study.headline.english;
  const tk = study.tokenizers;
  const maxFactor = Math.max(...study.groups.flatMap((g) => tk.map((t) => (g.byTokenizer as Record<string, { factor: number }>)[t.id].factor)));
  return (
    <div className="space-y-4">
      <h1>How wrong is &ldquo;4 characters per token&rdquo;?</h1>
      <p className="text-lg">
        The 4-characters rule underestimates <b>{w.group}</b> by <b>{w.factor}×</b> on <b>{w.tokenizer}</b> ({w.charsPerToken} characters per token).
        For English news prose on {en.tokenizer} it is {en.factor}× ({en.charsPerToken} characters per token).
      </p>
      <p className="text-sm text-zinc-500">
        {study.corpus.samples} samples, measured {study.generated.slice(0, 10)}. Method: {study.method}. All numbers on this page come from{" "}
        <a href="/data/study.json">results/study.json</a>.
      </p>

      <h2>Real tokens per estimated token</h2>
      <p className="text-sm text-zinc-500">Above 1× the estimate is too low; the bar shows the factor.</p>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Text</th>{tk.map((t) => <th key={t.id}>{t.label}</th>)}</tr></thead>
          <tbody>
            {study.groups.map((g) => (
              <tr key={g.group}>
                <td>{g.group} <span className="text-xs text-zinc-500">({g.samples})</span></td>
                {tk.map((t) => {
                  const x = (g.byTokenizer as Record<string, { factor: number; charsPerToken: number }>)[t.id];
                  return (
                    <td key={t.id} className="min-w-24">
                      {x.factor}× <span className="text-xs text-zinc-500">{x.charsPerToken} c/t</span>
                      <div className={`h-1.5 rounded ${x.factor > 1 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${(x.factor / maxFactor) * 100}%` }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Real usage check</h2>
      <p className="text-sm">
        {study.real.requests} of {study.real.planned} short requests to free-tier models returned usage. Overhead is the reported input tokens minus
        the local tokenizer&apos;s count of the prompt and system text: the tokens a provider adds for its chat format.
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Model</th><th>Local tokenizer</th><th>Requests</th><th>Overhead, no system</th><th>Overhead, with system</th><th>Median estimate error</th></tr></thead>
          <tbody>
            {study.real.summary.map((s) => (
              <tr key={s.model}>
                <td>{s.model}</td><td>{s.tokenizer}</td><td>{s.requests}</td>
                <td>{range(s.overheadNoSystem)}</td><td>{range(s.overheadWithSystem)}</td><td>{s.medianEstimateErrorPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Overhead shown as median (min–max). Gemini&apos;s tokenizer is not public; Gemma 3&apos;s stands in for it.</p>

      <h2>Corpus and licences</h2>
      <ul className="list-disc pl-5 text-sm">
        {study.corpus.sources.map((s) => <li key={s}>{s}</li>)}
      </ul>
    </div>
  );
}
