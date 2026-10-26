// Only the bundled tiktoken ranks are tested: Hugging Face tokenizers need the network.
import { expect, it } from "vitest";
import { loadTokenizer } from "./tokenizers";

it("counts with o200k_base and cl100k_base offline", async () => {
  expect((await loadTokenizer("o200k_base"))("hello world")).toBe(2);
  expect((await loadTokenizer("cl100k_base"))("hello world")).toBe(2);
});

it("treats special-token text as plain text", async () => {
  expect((await loadTokenizer("o200k_base"))("<|endoftext|>")).toBeGreaterThan(1);
});
