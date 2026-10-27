# How Overrun was built

A manual for builders who are new to coding with AI. You know some HTML and JavaScript and you can run commands in a terminal, but you have never sent a prompt to an AI model from your own code, run a tokenizer or measured what a request costs. By the end you should be able to run Overrun, change it, and build something like it yourself.

If a basic word is new to you (token, tokenizer, prompt, rate card, overhead), the beginner guide's [glossary](https://overrun-ashy.vercel.app/start/#token) defines it in one sentence. This manual defines the more technical words the first time they appear.

Every code excerpt below is copied from the repository, with its file path above it, and a test (`site/lib/building.test.ts`) fails if an excerpt stops matching its file. Anything the code does not show is marked **[TO CONFIRM]**.

## 1. The big picture

Text flows through Overrun in two phases: before you send a request, and after the provider has answered it.

<!-- diagram -->
```text
before you send:  input → estimate (chars ÷ 4) → local tokenizers → overhead model → rate card → receipt
after you send:   provider usage → reconcile → budget ledger
```

- **Input**: the prompt you paste, or a corpus sample whose counts come from the study.
- **Estimate (chars ÷ 4)**: Unicode characters divided by four and rounded up, always labelled as an estimate.
- **Local tokenizers**: four real tokenizers run in your browser and count the same text.
- **Overhead model**: adds the median (the middle value of the measurements) number of hidden tokens measured for the chosen model.
- **Rate card**: a dated price list turns token counts into integer nano-dollars.
- **Receipt**: prints the estimate, the real counts, the overhead, the projected bill and a stamp.
- **Provider usage**: after a request, the provider reports the tokens it really billed.
- **Reconcile**: splits the gap between estimate and actual into named reasons.
- **Budget ledger**: replays requests against a spending limit and blocks the ones that would exceed it.
<!-- /diagram -->

## 2. The tech stack, and why

| Piece | What it is | Why |
|---|---|---|
| Next.js 16 with `output: "export"` | A React framework; "static export" means the build produces plain HTML, CSS and JavaScript files, with no server code | Overrun has no back end and no database. Every page can be a file. |
| React 19 and TypeScript | UI library and typed JavaScript | Types catch mistakes such as mixing a token count with a price. |
| Tailwind CSS 4, plus hand-written CSS | Tailwind is imported in `site/app/globals.css`; almost all styling is hand-written CSS that copies the design handoff's tokens | The design came as a CSS prototype, so porting its CSS was the most faithful route. |
| `js-tiktoken` | A pure-JavaScript port of OpenAI's tiktoken tokenizer | Runs `o200k_base` and `cl100k_base` in the browser with no download from a third party. |
| `@huggingface/transformers` (Transformers.js) | Hugging Face's JavaScript library | Its `AutoTokenizer` runs the Llama 3.1 and Gemma 3 tokenizers in the browser. |
| `marked` | A Markdown-to-HTML converter | Renders this file on the `/build` page at build time, so the page and this file never drift apart. |
| Vitest | A test runner | Runs the unit tests, which never touch the network. |
| `tsx` | Runs TypeScript files directly with Node | Runs the study scripts in `study/`. |
| Vercel | A hosting service | Serves the static site. The project is linked to the GitHub repository with root directory `site`, and every push to `main` deploys. That link is set in Vercel's dashboard, not in the repo. |

### Which library runs which tokenizer

A **tokenizer** cuts text into tokens. Most modern ones use **BPE** (byte-pair encoding): starting from bytes, they repeatedly merge the most frequent neighbouring pair into a new token, which yields a fixed vocabulary of common pieces. Each tokenizer has its own vocabulary, so counts differ.

`site/lib/tokenizers.ts`

```ts
export const TOKENIZERS: { id: TokenizerId; label: string; usedBy: string; hf?: string }[] = [
  { id: "o200k_base", label: "o200k_base", usedBy: "GPT-4o, GPT-5, gpt-oss (Groq)" },
  { id: "cl100k_base", label: "cl100k_base", usedBy: "GPT-4, GPT-3.5" },
  { id: "llama3", label: "Llama 3.1", usedBy: "Llama 3.x", hf: "Xenova/Meta-Llama-3.1-Tokenizer" },
  { id: "gemma3", label: "Gemma 3", usedBy: "Gemma 3; closest open relative of Gemini's tokenizer", hf: "onnx-community/gemma-3-270m-it-ONNX" },
];
```

`o200k_base` and `cl100k_base` run in `js-tiktoken`. Llama 3.1 (Hugging Face repository `Xenova/Meta-Llama-3.1-Tokenizer`) and Gemma 3 (`onnx-community/gemma-3-270m-it-ONNX`) run in Transformers.js. Each one is loaded only when first needed:

`site/lib/tokenizers.ts`

```ts
async function load(id: TokenizerId): Promise<Counter> {
  if (id === "o200k_base" || id === "cl100k_base") {
    const { Tiktoken } = await import("js-tiktoken/lite");
    const ranks = id === "o200k_base" ? (await import("js-tiktoken/ranks/o200k_base")).default : (await import("js-tiktoken/ranks/cl100k_base")).default;
    const enc = new Tiktoken(ranks);
    // Special-token strings in user text are counted as plain text, as the APIs do.
    return (t) => enc.encode(t, [], []).length;
  }
  const { AutoTokenizer } = await import("@huggingface/transformers");
  const tok = await AutoTokenizer.from_pretrained(TOKENIZERS.find((t) => t.id === id)!.hf!);
  return (t) => tok.encode(t, { add_special_tokens: false }).length;
}
```

`await import(...)` is a *dynamic import*: the bundler (the build tool that packages the code for the browser) splits that code into a separate file that the browser fetches only when the line runs. The tiktoken vocabularies (`ranks`) are part of the npm package, so they ship from Overrun's own site. `AutoTokenizer.from_pretrained` downloads the tokenizer files from huggingface.co the first time.

Two words you will meet around Transformers.js. **ONNX** is a file format for AI models; the `onnx-community` repository name is there because that repository also hosts the Gemma model in ONNX format. **WASM** (WebAssembly) lets browsers run compiled code fast; Transformers.js uses it to run models. Overrun runs no model, only tokenizers, so it does not load model weights. Exactly which files `from_pretrained` downloads for a tokenizer, whether the WASM runtime is fetched when only a tokenizer is used, and how the browser caches the download are library behaviour the code does not show: **[TO CONFIRM]**.

## 3. Running it locally

You need Node.js and npm. It was built and tested with Node 24; the minimum version that works is **[TO CONFIRM]**.

```bash
cd site
npm install
npm test          # unit tests, no network
npm run dev       # http://localhost:3000
npm run build     # static site in site/out
```

An **API** (application programming interface) is a web address that a program sends a request to (here, a prompt) and that sends back a structured answer, including a `usage` block with token counts. An **API key** is the password that identifies you to it, and it is charged to your account, so it must stay secret.

API keys are only needed to re-run the real-usage part of the study, never for the site. Put them in a file called `.env` at the repository root:

```text
GROQ_API_KEY=...
GEMINI_API_KEY=...
```

`.env` is the first line of `.gitignore`, so it is never committed. The study script reads it through `tsx --env-file-if-exists=../.env` (see `study/package.json`). The site's code never reads environment variables: there is no `process.env` and no `NEXT_PUBLIC_` variable anywhere in `site/`, so no key can end up in the browser bundle.

## 4. A tour of the code

```text
docs/        PRD.md (the spec) and this file
site/        the website
  app/       pages (/, /start, /findings, /reconcile, /build) and their components
  lib/       the core: estimate, tokenizers, usage, pricing, ledger, reconcile, rate cards, tests
  public/data/   study.json and demo-log.json, copied here by the study script
study/       corpus.ts, corpus.json (the 200 samples), run.ts (the study), cache/ (ignored by git)
results/     study.json and demo-log.json, written by study/run.ts
RESULTS.md   the study's tables, written by study/run.ts
```

The core in `site/lib` has no React in it, so the browser pages, the tests and the Node study script all use the same functions:

| File | What it does | Used by |
|---|---|---|
| `errors.ts` | Two error kinds, `invalid` and `limit`, and `checked()`, which rejects values outside the unsigned 64-bit range (0 to about 1.8 × 10¹⁹) | everything below |
| `estimate.ts` | The four-characters estimate | calculator, reconcile, study |
| `tokenizers.ts` | Loads and runs the four tokenizers | calculator, reconcile upload, study |
| `usage.ts` | Validates provider usage JSON and normalises it to `{ input, output, cached }` | pricing, ledger, reconcile, study |
| `pricing.ts` | Integer cost in nano-dollars, and dollar formatting | receipt, reconcile, ledger |
| `ratecards.ts` | Dated price lists with source links | calculator, reconcile |
| `ledger.ts` | Budget replay: admit or block each request | reconcile page |
| `reconcile.ts` | Estimate vs actual, split into reasons; CSV and Markdown export | reconcile page, study |

`usage.ts` is the bridge to real providers. Each provider reports usage in a different shape, and the normaliser turns all of them into one record where cached tokens are part of the input, never extra:

`site/lib/usage.ts`

```ts
  if (has(u, "cache_read_input_tokens", "cache_creation_input_tokens") || (provider === "anthropic" && "input_tokens" in u)) {
    // Anthropic: input_tokens excludes cache reads and writes, so add them back.
    // shortcut: cache writes are priced as plain input (Anthropic bills them at 1.25x); add a rate if cache writes matter.
    const read = counter(u.cache_read_input_tokens, "cache_read_input_tokens");
    const write = counter(u.cache_creation_input_tokens, "cache_creation_input_tokens");
    return { provider: "anthropic", ...usage(counter(u.input_tokens, "input_tokens") + read + write, counter(u.output_tokens, "output_tokens"), read) };
  }
```

Anthropic's `input_tokens` leaves out cached tokens while OpenAI's includes them; normalising once means the rest of the code never has to care.

## 5. How the estimate and the counts work

The estimate is `ceil(Unicode characters / 4)`:

`site/lib/estimate.ts`

```ts
/** Unicode scalar values (code points), not UTF-16 units or bytes. */
export const charCount = (text: string) => BigInt([...text].length);

/** ceil(n / ratio) for a known number of characters. */
export function estimateChars(n: bigint, charsPerToken: bigint = 4n): bigint {
  if (charsPerToken <= 0n) throw invalid("ratio must be positive");
  return n / charsPerToken + (n % charsPerToken !== 0n ? 1n : 0n);
}
```

"Characters" means Unicode **code points**: the numbered entries in the Unicode table. JavaScript's `text.length` counts UTF-16 units instead, so an emoji such as 🙂 counts as 2; `[...text]` splits a string into code points, so 🙂 counts as 1. Bytes would be worse still: in UTF-8 each Tamil letter takes 3 bytes, so a byte count would triple Tamil's character count and hide exactly the gap the study measures. One catch remains: an emoji built from several code points joined together, such as 👩‍🍳 (woman, an invisible joiner, cooking), is 3 code points even though it shows as one picture.

Counts exclude **special tokens**: markers such as "start of text" that a model's software adds around a message. In the code above, `encode(t, [], [])` tells tiktoken to treat any special-token-looking text as plain text and add none, and `add_special_tokens: false` tells Transformers.js not to add its start marker. The estimate and every count therefore measure the same thing: your text alone. What the provider adds on top is measured separately, as overhead.

## 6. How the money maths works

Prices are tiny: $0.075 per million tokens is $0.000000075 per token. Floating-point numbers (JavaScript's normal `number`) cannot store most decimal fractions exactly, so sums of millions of them drift. Overrun stores money as whole **nano-dollars** (billionths of a dollar) in `BigInt`, JavaScript's arbitrary-size integer type. $0.075 per million tokens is exactly 75 nano-dollars per token.

`site/lib/pricing.ts`

```ts
export function cost(u: Usage, r: Rates): bigint {
  if (u.cached > u.input) throw invalid("cached exceeds input");
  if (r.input < 0n || r.output < 0n || r.cached < 0n) throw invalid("rates must be nonnegative");
  const a = checked((u.input - u.cached) * r.input);
  const b = checked(u.cached * r.cached);
  const c = checked(u.output * r.output);
  return checked(checked(a + b) + c);
}
```

Uncached input, cached input and output are charged separately. Nothing is rounded: whole tokens times whole nano-dollars is always a whole number. `checked()` throws if any step leaves the unsigned 64-bit range, which keeps the behaviour identical to the original Rust project whose tests Overrun reuses (see the Findings page's [Sources & licences](https://overrun-ashy.vercel.app/findings/#sources)). Displaying a price is also integer-only:

`site/lib/pricing.ts`

```ts
export function formatUsd(nano: bigint): string {
  const sign = nano < 0n ? "-" : "";
  const n = nano < 0n ? -nano : nano;
  const frac = (n % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${sign}$${n / 1_000_000_000n}.${frac}`;
}
```

The limit of this design: a price that is not a whole number of nano-dollars per token (for example $0.0375 per million) cannot be stored, and would need a finer unit.

Rate cards are plain TypeScript objects, each with its date and source, and a test fails if any card lacks either:

`site/lib/ratecards.ts`

```ts
  { id: "groq-gpt-oss-20b", provider: "groq", model: "openai/gpt-oss-20b", rates: { input: 75n, cached: 37n, output: 300n }, asOf: "2026-10-27", source: "https://console.groq.com/docs/model/openai/gpt-oss-20b" },
```

## 7. How the study was run

**Corpus.** 200 samples, built on 26 Oct 2026 by `study/corpus.ts` into `study/corpus.json`: the same 15 sentences from the NTREX-128 news corpus in 10 languages (English, Spanish, French, German, Russian, Arabic, Hindi, Tamil, Chinese, Japanese), 15 pieces of code (Rust, Python and TypeScript), 11 Markdown documents (technical documentation and Overrun's own spec), 12 JSON payloads (6 pretty-printed, 6 minified) and 12 emoji-heavy posts. Each sample records its source and licence; the attribution for the MIT-licensed code and documentation is on the Findings page under [Sources & licences](https://overrun-ashy.vercel.app/findings/#sources).

**Metrics.** For each kind of text and each tokenizer, `study/run.ts` sums characters, estimates and real tokens, then computes:

`study/run.ts`

```ts
      // errorPct < 0 means the estimate is too low; factor = real tokens per estimated token.
      return [t.id, { tokens, charsPerToken: r2(chars / tokens), errorPct: r1(((est - tokens) / tokens) * 100), factor: r2(tokens / est) }];
```

So `factor = real ÷ estimate` and `errorPct = (estimate − real) / real × 100`. These are statistics, not money, so ordinary floating point with 1–2 decimals is fine here.

**Real usage.** 50 requests: 25 prompts (two NTREX lines in each of the 10 languages, two code samples, one JSON, one Markdown and one emoji sample), each sent once to `openai/gpt-oss-20b` on Groq and once to `gemini-3.1-flash-lite` on Google, both on free tiers. 13 of the 25 prompts carry a one-line system prompt. For each response, overhead = reported input − local prompt tokens − local system tokens, using the tokenizer that matches the model (`o200k_base` for gpt-oss, Gemma 3 as the stand-in for Gemini).

Every call is cached on disk by a hash of its exact request, so re-running costs nothing and resumes after a quota stop:

`study/run.ts`

```ts
  const file = new URL(createHash("sha256").update(JSON.stringify({ url, body })).digest("hex") + ".json", cacheDir);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
```

A **hash** (here SHA-256) turns any input into a short fixed-length fingerprint; the same request always gives the same file name.

**Validation.** Measuring the overhead on the same requests you then explain would be circular. So the 50 requests are shuffled with a seeded random generator (seed 20261027) and split in half. The median overhead per model is measured on the first half, the *calibration set*, and the gap is explained only on the other half, the **held-out set**, which played no part in the measurement:

`study/run.ts`

```ts
const SEED = 20261027;
let state = SEED;
const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648; // seeded LCG, so the split never changes
const shuffled = demo.map((d) => d.id);
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const calibration = new Set(shuffled.slice(0, shuffled.length >> 1));
```

On the held-out half the named reasons explain 100% of the input-token gap, because the overhead turned out to be identical on every request of a model: +71 tokens for gpt-oss-20b without a system prompt and +74 with one, and +1 for Gemini 3.1 Flash-Lite.

**Commands.** From the repository root:

```bash
cd study
npm install
npm run study     # recounts the corpus, replays the 50 cached calls, writes results/ and RESULTS.md
```

`npm run study` copies `study.json` and `demo-log.json` into `site/public/data`. Without keys or a cache it still writes the tokenizer results, but the real-usage section comes out empty, and the site expects it to be filled. `npm run corpus` rebuilds the corpus from the network and from the current `site/lib` files; since those files have changed since 26 Oct 2026, it would change the TypeScript samples and their numbers, so treat `study/corpus.json` as frozen.

## 8. How Reconcile and the budget ledger work

The reconcile page reads a usage log: one entry per request, with the provider's raw `usage`, the local token counts and either the prompt text or its length in characters. The bundled demo log is the study's 50 requests and carries lengths, not texts. For each request, `reconcileOne` splits the gap into reasons that add up exactly:

`site/lib/reconcile.ts`

```ts
  const text = BigInt(e.local.prompt) - est;
  const system = BigInt(e.local.system);
  const o = overhead[e.model];
  const fmt = BigInt((e.system ? o?.withSystem : o?.noSystem) ?? 0);
  const unexplained = u.input - est - text - system - fmt;
```

The text effect, the system prompt, the overhead and whatever is left ("unexplained") sum to actual input minus the estimate. Output tokens and the cached-input discount change the cost but not the input, so they are kept apart, and a test checks both sums.

The ledger replays the requests in order. Each request's *quote* is the cost of its estimate plus its maximum output; it is admitted only if the money already spent plus the quote stays within the budget:

`site/lib/ledger.ts`

```ts
    if (spent + quote > budget) {
      settlements.push({ id: r.id, status: "blocked", reserved: 0n, actual: 0n, unused: 0n, overrun: 0n, reason: "reservation exceeds remaining budget" });
      continue;
    }
    const actual = cost(normalizeUsage(r.usage), log.rates);
    spent = checked(spent + actual);
```

An admitted request is then charged its actual cost, and stamped SETTLED if that is within the quote or OVERRUN if it is more. A blocked request is stamped BLOCKED and costs nothing. Replay stops if spending ever passes the budget. `ledger.ts` also has a standalone `reserve()` with the same rule; the replay applies the rule inline rather than calling it.

**Exports.** A **CSV** file (comma-separated values) is a plain-text table that spreadsheets open. `toCsv` writes one row per reason per request, with all money in nano-dollars, quoting any cell that contains a comma, quote or line break. `toMarkdown` writes a summary and one table row per request, and names the rate card with its date and source. The page turns either string into a file with a `Blob` (an in-memory file) and a temporary object URL, so the download never leaves the browser.

## 9. Design decisions

The site follows the "Fog & Signal" design handoff (Direction A): misty grey `#E8ECF0` and off-white `#F5F6F4` surfaces, one sharp vermilion accent `#C2410C` (`#FF7D4A` in dark mode), Instrument Serif for headings only, JetBrains Mono for labels and numbers, and Inter for body text. The fonts are loaded with `next/font/google`, which downloads them at build time and serves them from the site.

Numbers use `font-variant-numeric: tabular-nums`, which gives every digit the same width, so columns of figures line up and a changing number does not make the text around it jump.

The receipt prints with the Web Animations API: the paper slides out of the printer in 22 steps over 1.7 seconds, then the stamp lands. Under reduced motion it does not run at all:

`site/app/Calculator.tsx`

```ts
  function reprint() {
    const el = receipt.current;
    if (!el?.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: "translateY(-100%)" }, { transform: "translateY(0)" }], { duration: 1700, easing: "steps(22, end)" });
    el.querySelector(".stamp")?.animate(
      [{ opacity: 0, transform: "rotate(-5deg) scale(1.6)" }, { opacity: 1, transform: "rotate(-5deg) scale(1)" }],
      { duration: 350, delay: 1750, fill: "backwards", easing: "cubic-bezier(.2,1.4,.4,1)" },
    );
  }
```

The only other motion is a fade-in on page sections, which CSS also switches off under `prefers-reduced-motion`.

Colours are CSS variables on `:root`. Dark values apply when the system prefers dark, unless the reader chose a theme with the toggle; that choice is stored in `localStorage` and applied by a tiny script in the page head before the first paint, so the page never flashes the wrong theme:

`site/app/layout.tsx`

```ts
const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;
```

Two breakpoints from the handoff do the layout work: below 860px wide the hero, calculator and how-it-works strip stack into one column, and below 820px tall (short laptop screens) the hero, the big number and the receipt get tighter spacing.

## 10. What I'd do next, and known limits

- **Gemini's tokenizer is a proxy.** Google has not published it, so Gemma 3 stands in. In the study it came within 1 token, but that is not guaranteed for other text.
- **Input-only costs on the calculator** unless you enter expected output tokens. Reconcile does include reported output.
- **Rate cards go stale.** Each shows the date it was checked; they need re-checking by hand. A scheduled check against the source pages would help.
- **Overhead is known for two models only**, measured on 50 short requests.
- **Uploaded logs without local counts are counted with `o200k_base`**, whatever the model.
- **Anthropic cache writes** are priced as plain input; Anthropic charges more for them.
- Next: a per-model tokenizer choice for uploads, output-token estimates, and more models in the overhead measurement.

**[TO CONFIRM]**

- The minimum Node.js version that builds and runs the site and the study.
- Which files `AutoTokenizer.from_pretrained` downloads from huggingface.co for each tokenizer.
- Whether Transformers.js fetches its WebAssembly runtime when only a tokenizer is used.
- How, and for how long, the browser caches the downloaded Hugging Face tokenizer files.

## 11. Build your own

A smaller version you can finish in an afternoon:

1. **Count tokens for one model.** Install `js-tiktoken`, load `o200k_base`, and print `enc.encode(text).length` for a sentence in English and one in another language. Compare both with `Math.ceil([...text].length / 4)`.
2. **Add a price.** Look up one model's input price per million tokens, write down the date and the link, and convert it to whole nano-dollars per token (dollars per million × 1,000). Multiply by your count, using `BigInt`.
3. **Make one real API call.** Get a free key from a provider with a free tier, keep it in `.env` (and add `.env` to `.gitignore` first), and send your sentence with a Node script, never from browser code.
4. **Compare.** Read `usage` from the response. Subtract your local count from the reported input tokens: the difference is that provider's overhead for that request.
5. **Save and repeat.** Cache the response on disk by a hash of the request, send a few more prompts, and write the counts, the estimate and the overhead to a JSON file. That file is your first study.
