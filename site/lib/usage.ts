import { checked, invalid } from "./errors";

export type Usage = { input: bigint; output: bigint; cached: bigint };
export type Provider = "openai" | "anthropic" | "gemini" | "groq";

function counter(v: unknown, name: string): bigint {
  if (v === undefined || v === null) return 0n;
  if (typeof v === "bigint" && v >= 0n) return checked(v);
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  throw invalid(`${name}: nonnegative integer required`);
}

function usage(input: bigint, output: bigint, cached: bigint): Usage {
  if (cached > input) throw invalid("cached exceeds input");
  return { input: checked(input), output, cached };
}

/** Port of the original stage 2: "input,output,cached". */
export function parseUsageLine(line: string): Usage {
  const p = line.trim().split(",");
  if (p.length !== 3) throw invalid("input,output,cached required");
  if (p.some((s) => !/^[0-9]+$/.test(s))) throw invalid("unsigned counter required");
  const [i, o, c] = p.map((s) => checked(BigInt(s)));
  return usage(i, o, c);
}

const has = (o: Record<string, unknown>, ...keys: string[]) => keys.some((k) => k in o);

/**
 * R3: normalise a provider usage object (or a whole response holding one) into
 * { input, output, cached } where cached is a part of input, never extra.
 */
export function normalizeUsage(raw: unknown, provider?: Provider): Usage & { provider: Provider } {
  if (!raw || typeof raw !== "object") throw invalid("usage object required");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let u = raw as Record<string, any>;
  if (u.usageMetadata) u = u.usageMetadata;
  else if (u.x_groq?.usage) { u = u.x_groq.usage; provider ??= "groq"; }
  else if (u.usage && typeof u.usage === "object") u = u.usage;

  if (has(u, "promptTokenCount", "candidatesTokenCount")) {
    // Gemini: thinking tokens are billed as output.
    const out = counter(u.candidatesTokenCount, "candidatesTokenCount") + counter(u.thoughtsTokenCount, "thoughtsTokenCount");
    return { provider: "gemini", ...usage(counter(u.promptTokenCount, "promptTokenCount"), out, counter(u.cachedContentTokenCount, "cachedContentTokenCount")) };
  }
  if (has(u, "cache_read_input_tokens", "cache_creation_input_tokens") || (provider === "anthropic" && "input_tokens" in u)) {
    // Anthropic: input_tokens excludes cache reads and writes, so add them back.
    // shortcut: cache writes are priced as plain input (Anthropic bills them at 1.25x); add a rate if cache writes matter.
    const read = counter(u.cache_read_input_tokens, "cache_read_input_tokens");
    const write = counter(u.cache_creation_input_tokens, "cache_creation_input_tokens");
    return { provider: "anthropic", ...usage(counter(u.input_tokens, "input_tokens") + read + write, counter(u.output_tokens, "output_tokens"), read) };
  }
  if (has(u, "prompt_tokens")) {
    // OpenAI Chat Completions; Groq uses the same shape.
    const cached = counter(u.prompt_tokens_details?.cached_tokens, "cached_tokens");
    return { provider: provider === "groq" ? "groq" : "openai", ...usage(counter(u.prompt_tokens, "prompt_tokens"), counter(u.completion_tokens, "completion_tokens"), cached) };
  }
  if (has(u, "input_tokens")) {
    // OpenAI Responses API (the original project's format).
    const cached = counter(u.input_tokens_details?.cached_tokens, "cached_tokens");
    return { provider: provider ?? "openai", ...usage(counter(u.input_tokens, "input_tokens"), counter(u.output_tokens, "output_tokens"), cached) };
  }
  throw invalid("unrecognised usage format");
}
