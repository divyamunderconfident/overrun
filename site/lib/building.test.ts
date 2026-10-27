// docs/BUILDING.md quotes real code and real numbers; this keeps both true.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import study from "../public/data/study.json";

const root = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8").replace(/\r\n/g, "\n");
const md = read("docs/BUILDING.md");

it("every code excerpt matches its file", () => {
  // An excerpt is a line holding only `path/to/file.ext`, a blank line, then a fenced block.
  const excerpts = [...md.matchAll(/^`([\w./-]+\.\w+)`\n\n```\w*\n([\s\S]*?)\n```/gm)];
  expect(excerpts.length).toBeGreaterThanOrEqual(10);
  for (const [, path, code] of excerpts) expect(read(path), path).toContain(code);
});

it("quotes the study's numbers", () => {
  const [gptoss, gemini] = study.real.summary;
  expect(md).toContain(`+${gptoss.overheadNoSystem!.median} tokens for gpt-oss-20b without a system prompt and +${gptoss.overheadWithSystem!.median} with one`);
  expect(md).toContain(`+${gemini.overheadNoSystem!.median} for Gemini 3.1 Flash-Lite`);
  expect(md).toContain(`explain ${study.real.heldOut.explainedPct}% of the input-token gap`);
  expect(md).toContain(`seed ${study.real.heldOut.seed}`);
  expect(md).toContain(`${study.corpus.samples} samples, built on 26 Oct 2026`);
  expect(study.corpus.built).toBe("2026-10-26");
  expect(md).toContain(`${study.real.requests} requests: 25 prompts`);
});
