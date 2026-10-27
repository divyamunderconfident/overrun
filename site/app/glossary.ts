// One definition per word, shared by the "?" tips and the glossary on /start. Plain English, no undefined words.
export type TermId =
  | "ai-model" | "budget" | "characters" | "corpus" | "csv" | "estimate" | "factor" | "four-char-rule"
  | "input-output" | "markdown" | "median" | "overhead" | "prompt" | "provider" | "rate-card"
  | "reconcile" | "system-prompt" | "token" | "tokenizer" | "usage-log";

export const GLOSSARY: Record<TermId, { term: string; short: string }> = {
  "ai-model": { term: "AI model", short: "A computer program you send text to, and that writes text back. GPT, Gemini and Llama are AI models." },
  budget: { term: "Budget", short: "A spending limit you set. Overrun can block any message that would take your spending over it." },
  characters: { term: "Characters", short: "Single letters, digits, spaces, punctuation marks or emoji. “Hi!” is three characters." },
  corpus: { term: "Corpus sample", short: "A ready-made example text from the collection Overrun measured, such as news sentences in Tamil or a piece of code." },
  csv: { term: "CSV", short: "A plain table file that any spreadsheet program, such as Excel or Google Sheets, can open." },
  estimate: { term: "Estimate", short: "A guess, made before you send a message, of how many tokens it will use. Overrun always labels it as a guess." },
  factor: { term: "Factor (×)", short: "How many times bigger one number is than another. “5.35×” means the real count was 5.35 times the guess." },
  "four-char-rule": { term: "Four-characters rule", short: "A common rough guess: divide the number of characters by four to get the number of tokens." },
  "input-output": { term: "Input and output tokens", short: "Input tokens are what you send to the AI; output tokens are what it writes back. Providers price them separately." },
  markdown: { term: "Markdown", short: "Plain text with simple marks for headings and tables, which most writing and documentation tools can display." },
  median: { term: "Median", short: "The middle value when you line results up from smallest to largest, so one odd result does not pull it off." },
  overhead: { term: "Hidden overhead", short: "Extra tokens the provider adds to every message that you never typed, like a booking fee on a ticket." },
  prompt: { term: "Prompt", short: "The message you send to an AI model." },
  provider: { term: "Provider", short: "The company that runs an AI model and bills you for using it, such as Groq or Google." },
  "rate-card": { term: "Rate card", short: "A provider’s price list, in dollars per million tokens. Overrun shows the date each price was checked." },
  reconcile: { term: "Reconcile", short: "To compare what you expected to pay with what you were really charged, and explain the difference." },
  "system-prompt": { term: "System prompt", short: "Standing instructions sent along with every message, such as “Answer in one word”. They cost tokens too." },
  token: { term: "Token", short: "The small piece of text an AI reads and charges by: sometimes a whole word, sometimes part of one." },
  tokenizer: { term: "Tokenizer", short: "The “scissors” that cut text into tokens. Different models use different scissors, so counts differ." },
  "usage-log": { term: "Usage log", short: "A record, from the provider, of how many tokens each message really used." },
};
