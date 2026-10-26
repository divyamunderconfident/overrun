# PRD: Overrun — why your LLM bill does not match your estimate

Overrun is a free, in-browser tool that estimates what an LLM request will cost before you send it, checks the real usage the provider reports afterwards, and explains the gap. It also publishes a small study: how wrong the common "4 characters per token" rule is across languages, code and data, measured with real tokenizers. It grows out of the Starter project "Token Counter and Cost Meter" from AI Engineering from Scratch (MIT licence), and keeps that project's four ideas: a labelled estimate, validated usage records, integer-only pricing, and a budget ledger.

### Problem

Teams plan LLM features with a rough rule such as "4 characters is about 1 token", then the bill comes in higher. The rule breaks for non-English text, code, JSON and emoji, it ignores system prompts and output tokens, and cached tokens get counted twice by mistake. Floating-point cost maths adds small rounding errors that add up over millions of calls.

### Users

- Primary: PMs and engineers sizing the cost of an LLM feature before building it.
- Secondary: anyone checking an LLM usage log against a budget.

### Goals and non-goals

Goals

- An estimate that is always labelled as an estimate, with its rule shown.
- Exact accounting from the usage numbers providers actually report.
- Cost maths with integers only (nano-dollars), so totals never drift.
- A budget ledger that says which request would have been blocked.
- A published, reproducible measurement of how far the 4-characters rule is off, by kind of text.

Non-goals

- Not a live billing service and not a source of current prices: every rate card is a dated, editable fixture with its source link.
- No paid APIs. Real tokenizers run in the browser; real usage comes from free-tier calls.

### How it works

1. **Estimate:** count Unicode characters (not bytes), divide by a configurable ratio with ceiling division, and label the result "estimate".
2. **Count for real:** run open tokenizers in the browser (for example OpenAI's o200k_base and cl100k_base, and an open model's tokenizer such as Llama 3 or Qwen) and show each count next to the estimate.
3. **Validate usage:** read recorded usage JSON in the OpenAI, Anthropic, Gemini or Groq format, normalise it into one record, and reject impossible records (negative or fractional counts, or cached tokens greater than input tokens, since cached tokens are a part of input, not extra).
4. **Price:** multiply with integer nano-dollars per token and checked arithmetic (BigInt), charging uncached input, cached input and output separately.
5. **Admit:** replay a log against a budget: a request is admitted only if spent plus its quote stays within the limit.
6. **Reconcile:** for every request, show estimate vs actual and the reasons for the gap: language, code or JSON, system-prompt overhead, output tokens, cached tokens.

### The study (the portfolio evidence)

- Corpus: the same sentences in about 10 languages from a parallel corpus with a clear licence (for example FLORES+ or the Universal Declaration of Human Rights translations), plus code, JSON, markdown and emoji-heavy social text. About 200 samples, saved with their source and licence.
- Measure, per kind of text and tokenizer: real tokens vs the 4-characters estimate, as an error percentage and as "characters per token".
- Real usage check: send 50 short requests to free Groq and Gemini models, compare the reported input tokens with the estimate and with the local tokenizer, and measure the fixed overhead the provider adds per request.
- Headline: "The 4-characters rule underestimates <language> by N× on <tokenizer>", quoted only from the results file.

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| R1 | Estimator: Unicode character count, configurable ratio, ceiling division, labelled "estimate" | P0 must-have |
| R2 | Real tokenizer counts in the browser for at least 3 tokenizers | P0 must-have |
| R3 | Usage validator and normaliser for OpenAI, Anthropic, Gemini and Groq usage JSON | P0 must-have |
| R4 | Integer pricing in nano-dollars with checked arithmetic; dated, editable rate-card fixtures with source links | P0 must-have |
| R5 | Budget ledger: sequential replay, admit only if spent + quote ≤ limit, show blocked requests | P0 must-have |
| R6 | Reconciliation report: estimate vs actual per request, with the reasons for the gap; export as CSV and Markdown | P1 should-have |
| R7 | The study: corpus, measurement script, results JSON and RESULTS.md; findings page on the site | P0 must-have |
| R8 | Demo mode with a bundled usage log, so the site works with no key and no upload | P1 should-have |
| R9 | Port the core (R1, R3–R5) to Rust compiled to WebAssembly, as in the original course project, with the same tests | P2 nice-to-have |

### Success metrics

- Headline finding with a real number, quoted from the results file.
- Every unit test of the original course project's four stages passes against Overrun's core (same worked cases, e.g. 21 characters at ratio 4 → 6 tokens).
- Reconciliation explains at least 90% of the gap on the demo log (estimate error left unexplained, reported honestly).
- The site loads and works with no key, on a phone.

### Milestones

- Hours 1–2: core (R1, R3, R4, R5) with tests.
- Hours 3–4: tokenizers in the browser (R2), corpus and study (R7).
- Hours 5–6: site with demo mode (R6, R8), design, deploy, README.

### Risks

- Tokenizer downloads are large: load each tokenizer on demand and cache it in the browser.
- Prices change: never present a rate as current; every rate card shows its date and source, and users can edit it.
- Corpus licences: use only sources with a clear licence and credit them on the site.
- Provider token counts include hidden overhead: measure it instead of guessing, and say when it can't be explained.
