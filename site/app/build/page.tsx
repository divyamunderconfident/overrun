import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { marked } from "marked";

export const metadata: Metadata = { title: "How it was built · Overrun", description: "How Overrun works, for builders new to coding with AI." };

// The page is docs/BUILDING.md, rendered at build time, so the two never drift apart.
const md = readFileSync(join(process.cwd(), "..", "docs", "BUILDING.md"), "utf8").replace(/\r\n/g, "\n");

const slug = (s: string) => s.replace(/<[^>]+>/g, "").toLowerCase().replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function html(src: string) {
  return (marked.parse(src, { async: false }) as string)
    .replace(/https:\/\/overrun-ashy\.vercel\.app\//g, "/")
    .replace(/<h([23])>(.*?)<\/h\1>/g, (_, n, t) => `<h${n} id="${slug(t)}">${t}</h${n}>`)
    .replace(/<p><code>([\w./-]+\.\w+)<\/code><\/p>/g, '<p class="lab" style="margin:24px 0 6px">$1</p>');
}

/** The diagram section of BUILDING.md: a text diagram (for GitHub) and a list of "- **Box**: sentence" lines. */
function parseDiagram(block: string) {
  const after = block.split("\n").find((l) => l.startsWith("after you send:"))!.toLowerCase();
  return [...block.matchAll(/^- \*\*(.+?)\*\*: (.+)$/gm)].map(([, name, text]) => ({ name, text, after: after.includes(name.toLowerCase()) }));
}

export default function Build() {
  const [title, ...lines] = md.split("\n");
  const body = lines.join("\n");
  const [before, rest] = body.split("<!-- diagram -->");
  const [diagram, afterDiagram] = rest.split("<!-- /diagram -->");
  const boxes = parseDiagram(diagram);
  const phase = (after: boolean) => (
    <ol className="flow" aria-label={after ? "After you send" : "Before you send"}>
      {boxes.filter((b) => b.after === after).map((b) => (
        <li key={b.name}><div className={`box${after ? " after" : ""}`}><b>{b.name}</b><span>{b.text}</span></div></li>
      ))}
    </ol>
  );
  return (
    <section className="wrap fade sec end" style={{ paddingTop: 0 }} aria-labelledby="build-h">
      <div className="lab">How it was built · a manual for new builders</div>
      <h1 id="build-h" className="serif h1">{title.replace(/^# /, "")}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html(before) }} />
      <figure style={{ margin: "24px 0" }}>
        <div className="lab" style={{ marginBottom: 10 }}>Before you send</div>
        {phase(false)}
        <div className="lab" style={{ margin: "22px 0 10px" }}>After you send</div>
        {phase(true)}
      </figure>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html(afterDiagram) }} />
    </section>
  );
}
