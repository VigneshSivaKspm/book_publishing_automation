import fs from "node:fs";
import path from "node:path";
import { config, openaiConfigured } from "./config.ts";
import { checkOpenAi } from "./openai/health.ts";
import { ensureDir } from "./storage.ts";
import { browserAvailable } from "./render/browser.ts";

export async function diagnostics(runConnectionTest: boolean) {
  let storage = false;
  try {
    const probe = path.join(ensureDir(config.dataDir), ".probe");
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe);
    storage = true;
  } catch {
    storage = false;
  }
  let mupdf = false;
  try {
    await import("mupdf");
    mupdf = true;
  } catch {
    mupdf = false;
  }
  return {
    openai: runConnectionTest
      ? await checkOpenAi()
      : { configured: openaiConfigured(), reachable: null, models: { ocr: { name: config.ocrModel }, structure: { name: config.structureModel }, validation: { name: config.validationModel } } },
    renderer: { browserFound: !!config.browserPath, browserLaunches: runConnectionTest ? await browserAvailable() : null },
    pdfEngine: { mupdf },
    storage: { writable: storage },
    database: { kind: "filesystem", available: storage },
    queue: { kind: "in-process", concurrency: config.ocrConcurrency },
    limits: { maxUploadMb: Math.round(config.maxUploadBytes / 1048576), maxPages: config.maxPages },
    auth: { tokenRequired: !!config.accessToken },
  };
}
