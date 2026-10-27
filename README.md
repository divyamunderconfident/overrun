# Overrun

Why your LLM bill does not match your estimate. Overrun estimates what a request will cost before you send it, counts it with real tokenizers in your browser, prices it with integer nano-dollars, and reconciles the estimate against the usage the provider reports. Spec: [docs/PRD.md](docs/PRD.md).

**Live: https://overrun-ashy.vercel.app** (no key, no upload needed: demo mode loads a real usage log).

## Findings

From [results/study.json](results/study.json) (full tables in [RESULTS.md](RESULTS.md)):

- The 4-characters rule underestimates **Tamil by 5.35× on cl100k_base** (0.74 characters per token).
- Tamil on cl100k_base is 5.35× (0.74 characters per token) against 1.41× (2.8 characters per token) on o200k_base.
- For English news prose on o200k_base it *over*estimates: 0.84× (4.68 characters per token).
- In 50 real free-tier requests, `openai/gpt-oss-20b` on Groq reported 71 more input tokens than the o200k_base count of the text (74 with a system prompt), on every request. `gemini-3.1-flash-lite` reported 1 more than the Gemma 3 count, on every request.
- Held-out reconciliation: with that overhead measured on a fixed random half of the 50 requests (seed 20261027), the named reasons explain 100% of the input-token gap on the other 25 (0 of 1067 tokens unexplained).

## What is inside

| Req | Where |
|---|---|
| R1 estimator (Unicode chars, ceil division, labelled "estimate") | `site/lib/estimate.ts` |
| R2 tokenizers in the browser: o200k_base, cl100k_base (js-tiktoken), Llama 3.1, Gemma 3 (@huggingface/transformers), loaded on demand | `site/lib/tokenizers.ts` |
| R3 usage validator / normaliser for OpenAI, Anthropic, Gemini, Groq | `site/lib/usage.ts` |
| R4 integer nano-dollar pricing (BigInt, checked u64), dated rate-card fixtures with sources | `site/lib/pricing.ts`, `site/lib/ratecards.ts` |
| R5 budget ledger and replay | `site/lib/ledger.ts` |
| R6 reconciliation with reasons, CSV / Markdown export | `site/lib/reconcile.ts`, `/reconcile` |
| R7 study: corpus, measurement, real usage check | `study/`, `results/`, `/findings` |
| R8 demo mode: the 50 real requests from the study as a bundled log | `site/public/data/demo-log.json` |

Rate cards are dated fixtures copied from each provider's pricing page on 2026-10-26 or 2026-10-27 (each card carries its own date and source). They are not current prices; edit them on the site.

The site follows the "Fog & Signal" design handoff (Direction A): Instrument Serif for headlines, JetBrains Mono with tabular figures for numbers, light and dark themes, and a thermal receipt that prints each estimate (the animation is skipped under `prefers-reduced-motion`).

## Run it

```bash
cd site && npm install && npm test && npm run dev
```

Rebuild the study (tokenizer measurements are free; the real usage check needs `GROQ_API_KEY` and `GEMINI_API_KEY` in `.env`, uses free tiers, caches every call in `study/cache/` and resumes after a quota stop):

```bash
cd study && npm install && npm run corpus && npm run study
```

## Corpus licences

Parallel prose: [NTREX-128](https://github.com/MicrosoftTranslator/NTREX) (CC BY-SA 4.0), 15 lines in each of 10 languages. Code and markdown: the original course project (MIT) and this repo (MIT). JSON and emoji posts: written for this study (MIT). Each sample in `study/corpus.json` carries its source and licence.

## Credit

Overrun grows out of **"Token Counter and Cost Meter"** from [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/projects/token-counter-and-cost-meter) by Rohit Ghumare (MIT). Its four stages (estimate, validate usage, integer pricing, budget ledger) and their unit tests are ported to TypeScript in `site/lib/core.test.ts`, and its example usage log is a test fixture.
