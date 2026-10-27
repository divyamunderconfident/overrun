import type { Metadata } from "next";
import Link from "next/link";
import { replay } from "@/lib/ledger";
import { formatUsd } from "@/lib/pricing";
import { promptEstimate, reconcileOne, type UsageLog } from "@/lib/reconcile";
import demo from "@/public/data/demo-log.json";
import { DotChart } from "../DotChart";
import { fmt, group, longDate, MODELS, study } from "../data";
import { GLOSSARY, type TermId } from "../glossary";
import { computeReceipt, Receipt } from "../Receipt";
import { RequestCard } from "../RequestCard";

export const metadata: Metadata = { title: "Start here · Overrun", description: "A plain-English guide to Overrun for people new to AI." };

const log = demo as UsageLog;

export default function Start() {
  const ta = group("Tamil");
  const en = group("English");
  const groq = MODELS.find((m) => m.provider === "groq")!;
  const gem = MODELS.find((m) => m.provider === "gemini")!;
  const r = computeReceipt({ group: ta, text: "", system: "", ratio: 4n, out: 0n, counters: {}, model: groq, cardId: groq.card.id, rates: groq.card.rates });
  const card = MODELS[0].card;
  const ledger = replay({ limit: log.limit, rates: card.rates, requests: log.requests.map((q) => ({ id: q.id, estimate: { input_tokens: Number(promptEstimate(q)), output_limit: q.output_limit }, usage: q.usage })) });
  const blockedId = ledger.settlements.find((s) => s.status === "blocked")!.id;
  const example = log.requests.find((q) => q.provider === "gemini" && q.kind === "prose")!;
  const blocked = log.requests.find((q) => q.id === blockedId)!;
  const status = (id: string) => ledger.settlements.find((s) => s.id === id)?.status ?? "not reached";
  const hindi = group("Hindi").byTokenizer.cl100k_base;
  const glossary = (Object.keys(GLOSSARY) as TermId[]).sort((a, b) => GLOSSARY[a].term.localeCompare(GLOSSARY[b].term));
  const per1M = (n: bigint) => formatUsd(n * 1_000_000n);

  return (
    <>
      <section className="wrap fade" aria-labelledby="what-h">
        <div className="lab">Start here · a guide for people new to AI</div>
        <h1 id="what-h" className="serif h1">What is this?</h1>
        <div className="prose" style={{ marginTop: 20 }}>
          <p style={{ fontSize: 20 }}>
            Overrun tells you roughly what a message to an AI (a computer program that reads your text and writes text back) will cost before you send it.
            After you send it, Overrun checks what it really cost and explains any difference between the two.
            It is free, and it runs in your web browser.
          </p>
        </div>
        <aside className="sumcard prose" aria-labelledby="min-h" style={{ marginTop: 32 }}>
          <h2 id="min-h" className="lab" style={{ margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11 }}>In one minute</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>AI services charge for text in small pieces called tokens, not by the word or by the message.</li>
            <li>A popular shortcut guesses one token for every four letters, digits, spaces or symbols. It is close for English and far off for many other languages.</li>
            <li>For {ta.samples} Tamil news sentences, the shortcut guessed {fmt(ta.estimate)} tokens; one real count found {fmt(ta.byTokenizer.cl100k_base.tokens)}.</li>
            <li>AI companies also add tokens you never typed to every message. In Overrun&apos;s tests, one added {groq.overhead.noSystem.median} to each message.</li>
            <li>Overrun shows the guess, the real counts and the likely bill side by side, with dated prices, and afterwards explains the gap between the guess and the bill.</li>
          </ul>
        </aside>
      </section>

      <section className="wrap sec" aria-labelledby="ideas-h">
        <div className="lab">01 · The ideas you need</div>
        <h2 id="ideas-h" className="serif h2">Ten words, <em>in order.</em></h2>
        <div className="prose">
          <h3 id="idea-ai-model">AI model</h3>
          <p>An AI model is a computer program that you send text to, and that writes text back. GPT, Gemini and Llama are names of well-known AI models. Picture a translator at a desk: you hand over a note, and a reply comes back.</p>

          <h3 id="idea-prompt">Prompt</h3>
          <p>A prompt is the message you send to an AI model. It can be a question, an instruction, or a long document you want summarised. Some apps also attach standing instructions to every message, such as &ldquo;answer in one word&rdquo;; that part is called the system prompt. If the prompt is the letter you post, the system prompt is the note clipped to every letter.</p>

          <h3 id="idea-provider">Provider</h3>
          <p>A provider is the company that runs an AI model on its computers and bills you for using it. Overrun&apos;s measurements used two providers: Groq and Google. It works like a phone company: you use their network, and they send the bill.</p>

          <h3 id="idea-token">Token</h3>
          <p>An AI model does not read text letter by letter or word by word. It reads text cut into small pieces called tokens: sometimes a whole word, sometimes part of a word, a space or a punctuation mark. Providers count and charge by tokens, and they price the tokens you send (input tokens) separately from the tokens the model writes back (output tokens). Think of a taxi meter that charges by the segment, not by the trip.</p>

          <h3 id="idea-tokenizer">Tokenizer</h3>
          <p>A tokenizer is the tool that cuts text into tokens: a pair of scissors with its own cutting pattern. Different models use different tokenizers, so the same text can come out as a different number of tokens. Overrun has four: two used by the models of OpenAI (the company behind GPT), named o200k_base and cl100k_base, one for Llama 3.1, and one for Gemma 3. Two people cutting the same ribbon with different stencils end up with a different number of pieces.</p>

          <h3 id="idea-rate-card">Rate card</h3>
          <p>A rate card is a provider&apos;s price list. Prices are given in dollars per million tokens, because one token costs a tiny fraction of a cent. For example, Groq&apos;s price for the model {groq.model.replace("openai/", "")}, checked on {longDate(groq.card.asOf)}, was {per1M(groq.card.rates.input)} for every million input tokens. Prices change, so Overrun always shows the date each price was checked and where it came from, like the date printed on a café menu.</p>

          <h3 id="idea-four-char-rule">The four-characters rule</h3>
          <p>Counting tokens properly needs a tokenizer, so many people use a shortcut: count the characters (letters, digits, spaces, punctuation marks and emoji) and divide by four. The rule is close for English news text but goes badly wrong for many other languages, and for code and data. It is like guessing a taxi fare from the straight-line distance on a map: fine on a grid of straight streets, wrong on a winding mountain road.</p>

          <h3 id="idea-overhead">Hidden overhead</h3>
          <p>Providers add tokens of their own to every message before the model reads it. You never type them, but you pay for them. Providers do not list them, so Overrun measured how many there are: in its tests, {groq.model.replace("openai/", "")} on Groq added {groq.overhead.noSystem.median} tokens to every message, and {gem.model} on Google added {gem.overhead.noSystem.median}. It works like the booking fee added to every concert ticket.</p>

          <h3 id="idea-estimate">Estimate and actual</h3>
          <p>An estimate is a guess you make before you send a message. The actual number is what the provider reports afterwards, in a record called a usage log. Overrun always labels the guess as an estimate, so you never mistake it for the real number. It is the builder&apos;s quote before the job, and the invoice after it.</p>

          <h3 id="idea-budget">Budget</h3>
          <p>A budget is a spending limit you set. Overrun can go through your messages one at a time, keep a running total (the ledger), and block any message whose estimated cost would take the total over the limit. It is like a prepaid card that is declined once the balance runs out.</p>
        </div>
      </section>

      <section className="wrap sec" aria-labelledby="why-h">
        <div className="lab">02 · Why this matters</div>
        <h2 id="why-h" className="serif h2">One example, <em>printed out.</em></h2>
        <div className="annot" style={{ marginTop: 28 }}>
          <div className="receipt" style={{ maxWidth: 420 }}>
            <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: ".3em" }}>WORKED EXAMPLE</div>
            <div className="hr" />
            <div className="rl"><span>Tamil news text, {ta.samples} sentences</span></div>
            <div className="rl"><span>characters</span><span className="d" /><span>{fmt(ta.chars)}</span></div>
            <div className="hr" />
            <div className="rl"><span>four-characters rule (estimate)</span><span className="d" /><span>{fmt(ta.estimate)}</span></div>
            <div className="rl"><span>GPT-4&apos;s tokenizer (cl100k_base)</span><span className="d" /><span>{fmt(ta.byTokenizer.cl100k_base.tokens)}</span><span className="rmut">×{ta.byTokenizer.cl100k_base.factor.toFixed(2)}</span></div>
            <div className="rl"><span>newer tokenizer (o200k_base)</span><span className="d" /><span>{fmt(ta.byTokenizer.o200k_base.tokens)}</span><span className="rmut">×{ta.byTokenizer.o200k_base.factor.toFixed(2)}</span></div>
            <div style={{ textAlign: "center" }}><div className="stamp">UNDER BY {ta.byTokenizer.cl100k_base.factor.toFixed(2)}×</div></div>
          </div>
          <div className="prose">
            <p>Take the same {fmt(ta.chars)} characters of Tamil. The rule guesses {fmt(ta.estimate)} tokens. GPT-4&apos;s tokenizer, cl100k_base, counts {fmt(ta.byTokenizer.cl100k_base.tokens)}: {ta.byTokenizer.cl100k_base.factor.toFixed(2)} times the guess. A newer tokenizer, o200k_base, counts {fmt(ta.byTokenizer.o200k_base.tokens)}.</p>
            <p><b>If you budget with the rule, you&apos;d underestimate this bill by more than five times.</b></p>
            <p className="mut">For comparison, the rule guessed {fmt(en.estimate)} tokens for the English versions of the same sentences, and o200k_base counted {fmt(en.byTokenizer.o200k_base.tokens)}.</p>
          </div>
        </div>
      </section>

      <section className="wrap sec" aria-labelledby="use-h">
        <div className="lab">03 · How to use Overrun</div>
        <h2 id="use-h" className="serif h2">Three pages, <em>step by step.</em></h2>

        <div className="prose">
          <h3 id="use-calculator">The calculator, on the home page</h3>
          <ol className="steps">
            <li>Paste your own text into the Prompt box, or press one of the sample buttons (these are ready-made example texts that Overrun measured).</li>
            <li>Choose a model. Each one has its own tokenizer, hidden overhead and rate card.</li>
            <li>Read the estimate under the box. It is the four-characters guess, and it is labelled as one.</li>
            <li>Press <b>Print receipt</b>.</li>
            <li>Read the receipt line by line, using the numbered notes below.</li>
          </ol>
        </div>
        <figure className="annot" style={{ margin: "24px 0 0" }}>
          <div>
            <div className="panel" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["English", "Hindi", "Tamil", "Code"].map((s) => <span key={s} className={`chip${s === "Tamil" ? " on" : ""}`} style={{ display: "inline-flex", alignItems: "center" }}>{s}</span>)}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><span className="chip on" style={{ display: "inline-flex", alignItems: "center" }}>{groq.model.replace("openai/", "")} · Groq</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div><div className="lab">Characters</div><div className="mono stat">{fmt(r.chars)}</div></div>
                <div><div className="lab">Estimate · ÷4</div><div className="mono stat">{fmt(r.est)}</div></div>
              </div>
            </div>
            <Receipt r={r} date="" marks />
          </div>
          <figcaption>
            <ol>
              <li><span className="mark">1</span><span><b>Estimate.</b> The four-characters guess: {fmt(r.chars)} characters ÷ 4 = {fmt(r.est)}. A guess, not a count.</span></li>
              <li><span className="mark">2</span><span><b>Real count.</b> What each of the four tokenizers counted, and how many times the guess that is (×). The arrow marks the tokenizer the chosen model uses.</span></li>
              <li><span className="mark">3</span><span><b>Hidden overhead.</b> The tokens this provider adds to every message: {r.o.median} for {groq.model.replace("openai/", "")}. It is the median (the middle value) of {r.o.n} messages Overrun measured.</span></li>
              <li><span className="mark">4</span><span><b>Billed input (projected).</b> The model&apos;s count plus the hidden overhead: {fmt(r.billed!)} tokens. &ldquo;Projected&rdquo; means a forecast of what the provider will charge for.</span></li>
              <li><span className="mark">5</span><span><b>Cost.</b> The estimate and the projection priced with the rate card ({formatUsd(r.costEst)} and {formatUsd(r.costProj!)}), then for 1,000 messages. The rate card&apos;s date and source are printed underneath. These are input costs only.</span></li>
              <li><span className="mark">6</span><span><b>The stamp.</b> &ldquo;{r.worst!.v.dir} BY {r.worst!.v.x.toFixed(2)}×&rdquo; means the biggest real count, on {r.worst!.label}, is {r.worst!.v.x.toFixed(2)} times the guess. &ldquo;OVER&rdquo; would mean the guess was too high.</span></li>
            </ol>
            <p className="mut" style={{ fontSize: 14 }}>The receipt above is the real one for the Tamil sample and {groq.model.replace("openai/", "")}, built from the study&apos;s numbers.</p>
          </figcaption>
        </figure>

        <div className="prose">
          <h3 id="use-findings">Findings</h3>
          <p>The Findings page shows how many characters fit in one token for each kind of text, on each tokenizer. That number is called characters per token.</p>
          <ol className="steps">
            <li>Each row is one kind of text, such as English news, Tamil news or computer code.</li>
            <li>Each dot is one tokenizer. Its position along the line is the number of characters per token.</li>
            <li>Dots further to the left mean fewer characters fit in a token, so the same text becomes more tokens and costs more.</li>
            <li>The dashed line marks 4, the four-characters rule. Dots to the left of it are texts the rule underestimates.</li>
          </ol>
        </div>
        <figure style={{ margin: "16px 0 0" }}>
          <DotChart tokenizers={["o200k_base", "cl100k_base"]} only={["English", "Tamil", "Chinese", "code"]} />
          <figcaption className="mut" style={{ fontSize: 14, marginTop: 10 }}>Four rows from the real chart. English sits near the dashed line; Tamil on cl100k_base sits far to the left.</figcaption>
        </figure>

        <div className="prose">
          <h3 id="use-reconcile">Reconcile</h3>
          <p>A usage log is the record a provider gives you, after you send messages, of how many tokens each one really used. The Reconcile page reads a usage log and compares it with the four-characters estimate, one message (a &ldquo;request&rdquo;) at a time. It opens with a demo log of {log.requests.length} real requests that Overrun sent while measuring, so it works without any upload.</p>
          <ol className="steps">
            <li>Look at the top of each card: the estimate in tokens.</li>
            <li>Read the lines underneath: each one is a reason for the gap, with its number of tokens. They add up to the actual input the provider reported.</li>
            <li>Below the line come costs that are not part of the input, such as the tokens the model wrote back (output tokens).</li>
            <li>Check the stamp. SETTLED means the message was let through and cost no more than its estimate. BLOCKED means the running total plus this message&apos;s estimated cost would have gone over the budget, so Overrun would have stopped it. OVERRUN means it was let through but cost more than its estimate.</li>
            <li>Press <b>Export CSV</b> to get a table for a spreadsheet program such as Excel, or <b>Export Markdown</b> to get a report you can paste into a document.</li>
          </ol>
        </div>
        <div className="cards" style={{ marginTop: 16 }}>
          <RequestCard r={reconcileOne(example, card.rates, log.overhead)} status={status(example.id)} />
          <RequestCard r={reconcileOne(blocked, card.rates, log.overhead)} status={status(blocked.id)} />
        </div>
        <p className="mut" style={{ fontSize: 14 }}>Two real cards from the demo log, priced with the {card.provider} rate card for {card.model}, checked on {longDate(card.asOf)}.</p>
      </section>

      <section className="wrap sec" aria-labelledby="limits-h">
        <div className="lab">04 · What Overrun can&apos;t do</div>
        <h2 id="limits-h" className="serif h2">Honest <em>limits.</em></h2>
        <div className="prose">
          <ul>
            <li>It estimates and explains. It does not send messages to an AI for you.</li>
            <li>Prices can change after the date shown on each rate card. Check the provider&apos;s page before you rely on one.</li>
            <li>Google has not published Gemini&apos;s tokenizer, so Overrun uses its closest open relative, Gemma 3, instead. The counts are close but not guaranteed to match.</li>
            <li>Costs on the calculator are for input tokens only, unless you enter expected output tokens under &ldquo;More options&rdquo;. On Reconcile, the actual cost includes the output tokens the provider reported.</li>
            <li>The hidden overhead was measured for two models only, on {study.real.requests} messages. For any other model, Overrun does not know it.</li>
          </ul>
        </div>
      </section>

      <section className="wrap sec" aria-labelledby="faq-h">
        <div className="lab">05 · Common questions</div>
        <h2 id="faq-h" className="serif h2">Questions people <em>ask first.</em></h2>
        <div className="prose">
          <h3>Is my text sent anywhere?</h3>
          <p>No. Nothing leaves your browser until you send it to a provider yourself. Overrun does its counting on your own computer. The only things it downloads are the tokenizers themselves: two of them come from a website called Hugging Face the first time you choose them, and your text is not sent with that download.</p>
          <h3>Why do two tokenizers disagree?</h3>
          <p>Each tokenizer has its own fixed list of pieces. A piece that one tokenizer keeps whole, another may have to cut into several. Tamil shows how big the difference can be: the same text is {fmt(ta.byTokenizer.cl100k_base.tokens)} tokens on cl100k_base and {fmt(ta.byTokenizer.o200k_base.tokens)} on o200k_base.</p>
          <h3>Why is non-English text often more expensive?</h3>
          <p>When a tokenizer&apos;s list holds few pieces for a language, it has to cut that language&apos;s words into many small pieces, so the same sentence becomes more tokens. In Overrun&apos;s study, Hindi on cl100k_base needed {hindi.factor.toFixed(2)} times as many tokens as the four-characters rule guessed.</p>
          <h3>Which number should I trust?</h3>
          <p>After you send a message, trust the provider&apos;s own usage log: that is what you are billed for. Before you send, the best guess is the billed input on the receipt, which uses the tokenizer that matches your model plus the measured overhead. The four-characters estimate is the roughest of the three.</p>
          <h3>Do I need an account?</h3>
          <p>No. There is nothing to sign up for and no key to enter.</p>
        </div>
      </section>

      <section className="wrap sec end" aria-labelledby="gloss-h">
        <div className="lab">06 · Glossary</div>
        <h2 id="gloss-h" className="serif h2">Every word, <em>A to Z.</em></h2>
        <dl className="prose" style={{ marginTop: 24 }}>
          {glossary.map((id) => (
            <div key={id} id={id} style={{ scrollMarginTop: 24, borderBottom: "1px solid var(--line)", padding: "14px 0" }}>
              <dt className="serif" style={{ fontSize: 24 }}>{GLOSSARY[id].term}</dt>
              <dd style={{ margin: "4px 0 0", fontSize: 16 }}>{GLOSSARY[id].short}</dd>
            </div>
          ))}
        </dl>
        <p style={{ marginTop: 40 }}>
          <Link className="btn" href="/">Try the calculator</Link>{" "}
          <Link className="pill" href="/build/" style={{ minHeight: 48, padding: "0 20px" }}>Next: how it was built →</Link>
        </p>
      </section>
    </>
  );
}
