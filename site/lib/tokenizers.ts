// R2: real tokenizers, each loaded on demand (dynamic import) and kept once loaded.
// Hugging Face tokenizers download their tokenizer.json on first use; the browser caches it.
export type TokenizerId = "o200k_base" | "cl100k_base" | "llama3" | "gemma3";

export const TOKENIZERS: { id: TokenizerId; label: string; usedBy: string; hf?: string }[] = [
  { id: "o200k_base", label: "o200k_base", usedBy: "GPT-4o, GPT-5, gpt-oss (Groq)" },
  { id: "cl100k_base", label: "cl100k_base", usedBy: "GPT-4, GPT-3.5" },
  { id: "llama3", label: "Llama 3.1", usedBy: "Llama 3.x (Groq llama-3.1-8b-instant)", hf: "Xenova/Meta-Llama-3.1-Tokenizer" },
  { id: "gemma3", label: "Gemma 3", usedBy: "Gemma 3; closest open relative of Gemini's tokenizer", hf: "onnx-community/gemma-3-270m-it-ONNX" },
];

export type Counter = (text: string) => number;
const loaded = new Map<TokenizerId, Promise<Counter>>();

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

export function loadTokenizer(id: TokenizerId): Promise<Counter> {
  if (!loaded.has(id)) loaded.set(id, load(id).catch((e) => { loaded.delete(id); throw e; }));
  return loaded.get(id)!;
}
