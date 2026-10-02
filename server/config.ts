import fs from "node:fs";
import path from "node:path";

/**
 * Server-side configuration. Secrets are read from the process environment
 * or from `.env` / `.env.server` in the project root. Nothing here is ever
 * sent to the browser; VITE_* variables are deliberately ignored for keys.
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function loadDotEnv(file: string): void {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(".env.server");
loadDotEnv(".env");

if (process.env.VITE_OPENAI_API_KEY) {
  // A VITE_ prefixed key would be bundled into the browser build.
  console.warn("[config] VITE_OPENAI_API_KEY is set. It is ignored and must be removed: VITE_ variables are exposed to the browser.");
}

function int(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function findBrowser(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean) as string[];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

export const config = {
  root: ROOT,
  port: int("API_PORT", 8787),
  dataDir: path.resolve(ROOT, process.env.DATA_DIR || "data"),

  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  /** Vision OCR / page understanding model. */
  ocrModel: process.env.OPENAI_OCR_MODEL?.trim() || "gpt-5",
  /** Precision pass (math, tables, low-confidence regions). */
  structureModel: process.env.OPENAI_STRUCTURE_MODEL?.trim() || "gpt-5",
  /** Cheap checks (connection test). */
  validationModel: process.env.OPENAI_VALIDATION_MODEL?.trim() || "gpt-5-mini",
  reasoningEffort: (process.env.OPENAI_REASONING_EFFORT?.trim() || "low") as "minimal" | "low" | "medium" | "high",

  ocrConcurrency: int("OCR_CONCURRENCY", 4),
  ocrMaxAttempts: int("OCR_MAX_ATTEMPTS", 4),
  ocrTimeoutMs: int("OCR_TIMEOUT_MS", 240_000),
  ocrDpi: int("OCR_DPI", 300),
  ocrDpiDense: int("OCR_DPI_DENSE", 400),

  maxUploadBytes: int("MAX_UPLOAD_MB", 200) * 1024 * 1024,
  maxPages: int("MAX_PAGES", 600),

  /** Optional shared secret. When set, every /api route requires `Authorization: Bearer <token>`. */
  accessToken: process.env.APP_ACCESS_TOKEN?.trim() || "",

  browserPath: findBrowser(),
} as const;

export function openaiConfigured(): boolean {
  return config.openaiApiKey.length > 0;
}
