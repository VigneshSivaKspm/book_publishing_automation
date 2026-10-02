/**
 * TEST-ONLY stand-in for the OpenAI Responses API (wire compatible). It
 * derives page content from the embedded text layer the pipeline sends, so
 * orchestration, retries, schema handling and the UI can be exercised without
 * an OpenAI account. It is never used by the application itself.
 *
 *   node scripts/fake-openai.ts [port]   → standalone (for UI testing)
 */
import http from "node:http";

export interface FakeStats {
  requests: number;
  imagesSeen: number[];
  throttleFirst: boolean;
  delayMs: number;
}

function pageFromTextLayer(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: unknown[] = [];
  const answerKey: { question: string; answer: string }[] = [];
  if (lines.some((l) => /ANSWER KEY/.test(l))) {
    for (let i = 0; i < lines.length - 1; i++) {
      const m = lines[i].match(/^(\d+)\.$/);
      if (m && /^[A-E-]$/.test(lines[i + 1])) answerKey.push({ question: m[1], answer: lines[i + 1] });
    }
  } else {
    let cur: { number: string; stem: string; options: { label: string; text: string }[]; year: string | null } | null = null;
    const flush = () => {
      if (!cur) return;
      blocks.push({
        type: "question", heading_level: null, section_number: null, text: null, latex: null, list_items: null, table: null, figure: null,
        question: { number: cur.number, kind: "mcq", stem: cur.stem, year: cur.year, options: cur.options, match: null, assertion: null, reason: null, statements: [], has_figure: false },
        bbox: { x: 0.05, y: 0.1, w: 0.4, h: 0.1 }, confidence: 0.97, uncertain_spans: [], continued_from_previous_page: false,
      });
      cur = null;
    };
    for (const l of lines) {
      const q = l.match(/^(\d{1,3})\.\s*(.*)$/);
      const o = l.match(/^([A-D])\)\s*(.*)$/);
      // Question numbers increase on a page; smaller numbers are list labels inside a question.
      if (q && cur && Number(q[1]) <= Number(cur.number)) {
        if (!cur.options.length) cur.stem += ` ${l}`;
      } else if (q) {
        flush();
        const year = q[2].match(/\((\d{4})\)\s*$/)?.[1] ?? null;
        cur = { number: q[1], stem: q[2].replace(/\(\d{4}\)\s*$/, "").trim(), options: [], year };
      } else if (o && cur) cur.options.push({ label: o[1], text: o[2] });
      else if (cur && !cur.options.length) cur.stem += ` ${l}`;
    }
    flush();
  }
  return {
    page_kind: answerKey.length ? "answer_key" : "content", layout: "two_column", languages: ["en"], chapter: null,
    running_header: null, running_footer: null, printed_page_number: null, blocks, answer_key: answerKey,
    continues_to_next_page: false, page_confidence: 0.97, notes: [],
  };
}

export async function startFakeOpenAI(port: number): Promise<{ server: http.Server; stats: FakeStats }> {
const stats: FakeStats = { requests: 0, imagesSeen: [], throttleFirst: true, delayMs: 0 };
const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (req.method === "GET" && req.url?.startsWith("/v1/models/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ id: req.url.split("/").pop(), object: "model" }));
  }
  if (req.method !== "POST" || !req.url?.startsWith("/v1/responses")) {
    res.writeHead(404);
    return res.end();
  }
  stats.requests++;
  if (stats.delayMs) await new Promise((r) => setTimeout(r, stats.delayMs));
  if (stats.throttleFirst) {
    stats.throttleFirst = false;
    res.writeHead(429, { "Content-Type": "application/json", "retry-after-ms": "300" });
    return res.end(JSON.stringify({ error: { message: "Rate limit reached", type: "requests", code: "rate_limit_exceeded" } }));
  }
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const content = body.input[0].content as { type: string; text?: string }[];
  stats.imagesSeen.push(content.filter((c) => c.type === "input_image").length);
  const prompt = content.filter((c) => c.type === "input_text").map((c) => c.text).join("\n");
  const schemaName = body.text?.format?.name;
  let out: unknown;
  if (schemaName === "precision_blocks") out = { blocks: [] };
  else {
    const layer = prompt.match(/<<<TEXT_LAYER\n([\s\S]*?)\nTEXT_LAYER>>>/)?.[1] ?? "";
    out = pageFromTextLayer(layer);
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    id: `resp_${stats.requests}`, object: "response", created_at: Date.now() / 1000, status: "completed", model: body.model,
    output: [{ type: "message", id: `msg_${stats.requests}`, status: "completed", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(out), annotations: [] }] }],
    usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
  }));
});
await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
return { server, stats };
}


if (process.argv[1]?.endsWith("fake-openai.ts")) {
  const port = Number(process.argv[2] ?? 8899);
  const { stats } = await startFakeOpenAI(port);
  stats.throttleFirst = false;
  console.log(`fake OpenAI Responses API listening on http://127.0.0.1:${port}/v1 (test only)`);
}
