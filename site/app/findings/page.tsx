import type { Metadata } from "next";
import { TOKENIZERS } from "@/lib/tokenizers";
import { DotChart } from "../DotChart";
import { fmt, group, groupLabel, groups, longDate, study } from "../data";
import { Term, Tip } from "../Tip";

export const metadata: Metadata = { title: "Findings · Overrun" };

const MIT_TEXT = `MIT License

Copyright (c) [COPYRIGHT HOLDER]

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

type Range ={ median: number; min: number; max: number; n: number } | null | undefined;
const range = (o: Range) => (o ? `+${o.median} (${o.min}–${o.max}, n=${o.n})` : "n/a");

export default function Findings() {
  const w = study.headline.worst;
  const en = study.headline.english;
  const ta = study.headline.tamil;
  const tg = group("Tamil");
  const h = study.real.heldOut;
  return (
    <>
      <section className="wrap fade" aria-labelledby="f-h">
        <div className="lab">Findings · measured {longDate(study.generated.slice(0, 10))}</div>
        <h1 id="f-h" className="serif h1" style={{ maxWidth: 900 }}>How wrong is &ldquo;four characters per token&rdquo;? <em>It depends what you write.</em></h1>
        <p style={{ fontSize: 18, maxWidth: 760, marginTop: 24 }}>
          The <Term id="four-char-rule">4-characters rule</Term> underestimates <b>{w.group}</b> by <span className="mono acc">{w.factor}×</span><Tip id="factor" /> on {w.tokenizer} ({w.charsPerToken} characters per <Term id="token">token</Term>).
          For English news prose on {en.tokenizer} it overestimates: <span className="mono">{en.factor}×</span> ({en.charsPerToken} characters per token).
        </p>
      </section>

      <section className="wrap sec" aria-labelledby="ta-h">
        <div className="lab">01 · One language, two <Term id="tokenizer">tokenizers</Term></div>
        <h2 id="ta-h" className="serif h2">Tamil on cl100k_base <em>vs</em> o200k_base.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, marginTop: 32 }}>
          {(["cl100k_base", "o200k_base"] as const).map((t) => (
            <div className="panel" key={t}>
              <div className="lab">{t} · {TOKENIZERS.find((x) => x.id === t)!.usedBy}</div>
              <div className="mono" style={{ fontSize: "clamp(48px, 8vw, 88px)", lineHeight: 1, margin: "12px 0" }}>{ta[t].factor}<span className="acc" style={{ fontSize: ".4em" }}>×</span></div>
              <div className="mono mut" style={{ fontSize: 13 }}>{ta[t].charsPerToken} chars/token · {fmt(ta[t].tokens)} real tokens vs estimate {fmt(tg.estimate)}</div>
            </div>
          ))}
        </div>
        <p className="mut" style={{ maxWidth: 680 }}>Same {tg.samples} sentences, {fmt(tg.chars)} characters. The newer vocabulary needs {(ta.cl100k_base.tokens / ta.o200k_base.tokens).toFixed(2)}× fewer tokens for them.</p>
      </section>

      <section className="wrap sec" aria-labelledby="cpt-h">
        <div className="lab">02 · All text, all tokenizers</div>
        <h2 id="cpt-h" className="serif h2" style={{ marginBottom: 28 }}>Characters per token, <em>by what you write.</em></h2>
        <DotChart tokenizers={TOKENIZERS.map((t) => t.id)} />
        <h3 className="lab" style={{ margin: "48px 0 12px" }}>Real tokens per estimated token (above 1× the estimate is too low)</h3>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Text</th><th>Samples</th><th>Estimate</th>{TOKENIZERS.map((t) => <th key={t.id}>{t.label}</th>)}</tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.group}>
                  <td>{groupLabel(g.group)}</td>
                  <td className="num">{g.samples}</td>
                  <td className="num">{fmt(g.estimate)}</td>
                  {TOKENIZERS.map((t) => {
                    const x = g.byTokenizer[t.id];
                    return <td key={t.id} className="num" style={{ color: x.factor > 1 ? "var(--acc-ink)" : undefined }}>{x.factor.toFixed(2)}× <span className="mut" style={{ fontSize: 12 }}>{fmt(x.tokens)}</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wrap sec" aria-labelledby="real-h">
        <div className="lab">03 · Real usage, {study.real.requests} requests</div>
        <h2 id="real-h" className="serif h2">The tokens you <em>never typed.</em></h2>
        <p className="mut" style={{ maxWidth: 720 }}>
          Short requests to free-tier models. <Term id="overhead">Overhead</Term> is the reported input tokens minus the local tokenizer&apos;s count of the prompt and <Term id="system-prompt">system</Term> text: tokens the provider adds that nobody typed.
        </p>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Model</th><th>Local tokenizer</th><th>Requests</th><th>Overhead, no system</th><th>Overhead, with system</th><th><Term id="median">Median</Term> <Term id="estimate">estimate</Term> error</th></tr></thead>
            <tbody>
              {study.real.summary.map((s) => (
                <tr key={s.model}>
                  <td className="mono">{s.model}</td><td className="mono">{s.tokenizer}</td><td className="num">{s.requests}</td>
                  <td className="num">{range(s.overheadNoSystem)}</td><td className="num">{range(s.overheadWithSystem)}</td><td className="num">{s.medianEstimateErrorPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel" style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, alignItems: "center" }}>
          <div className="mono" style={{ fontSize: "clamp(48px, 8vw, 88px)", lineHeight: 1 }}>{h.explainedPct}<span className="acc" style={{ fontSize: ".4em" }}>%</span></div>
          <p style={{ margin: 0 }}>
            <b>Held-out reconciliation.</b> Overhead was measured on a fixed random half ({h.calibration.length} requests, seed <span className="num">{h.seed}</span>). On the other {h.heldOut.length}, the named reasons explain {h.explainedPct}% of the input-token gap: <span className="num">{fmt(h.unexplainedTokens)}</span> of <span className="num">{fmt(h.gapTokens)}</span> tokens unexplained.
          </p>
        </div>
        <p className="mut" style={{ fontSize: 13 }}>Gemini&apos;s tokenizer isn&apos;t public; Gemma 3, its closest open relative, stands in for the count.</p>
      </section>

      <section className="wrap sec end" aria-labelledby="m-h">
        <div className="lab">04 · Method, sources, licences</div>
        <h2 id="m-h" className="serif h2" style={{ marginBottom: 20 }}>How it was measured.</h2>
        <p className="mono" style={{ fontSize: 13, maxWidth: 820 }}>{study.method}</p>
        <p className="mut" style={{ fontSize: 14 }}>
          {study.corpus.samples} samples, corpus built {longDate(study.corpus.built)}. Every number on this page is read from <a href="/data/study.json">results/study.json</a>; the corpus with each sample&apos;s source and licence is <code>study/corpus.json</code> in the repo.
        </p>
        <h3 id="sources" className="serif" style={{ fontSize: 28, margin: "40px 0 8px" }}>Sources &amp; licences</h3>
        <ul className="mut" style={{ fontSize: 14, paddingLeft: 18 }}>
          {study.corpus.sources.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mut" style={{ fontSize: 14 }}>
          Parallel prose: <a href="https://github.com/MicrosoftTranslator/NTREX">NTREX-128</a>, CC BY-SA 4.0. Rust and Python sample code and technical documentation: MIT. Synthetic JSON and emoji posts: written for this study, MIT.
        </p>
        <p style={{ fontSize: 14 }}>
          Code and documentation samples from [PROJECT NAME], © [COPYRIGHT HOLDER], used under the{" "}
          <a href="https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/LICENSE">MIT License</a>.
        </p>
        <details style={{ fontSize: 13 }}>
          <summary className="lab">MIT License text</summary>
          <pre className="mono mut" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{MIT_TEXT}</pre>
        </details>
        <p className="mut" style={{ fontSize: 14 }}>Overrun itself is MIT licensed; see the LICENSE file in <a href="https://github.com/divyamunderconfident/overrun">its repository</a>.</p>
      </section>
    </>
  );
}
