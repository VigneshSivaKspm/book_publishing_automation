/** Structured server logging. Never pass secrets or full document text here. */

type Level = "info" | "warn" | "error";

const KEY_PATTERN = /sk-[A-Za-z0-9_-]{8,}/g;

function redact(value: unknown): unknown {
  if (typeof value === "string") return value.replace(KEY_PATTERN, "sk-***");
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = /key|token|authorization|secret/i.test(k) ? "***" : redact(v);
    }
    return out;
  }
  return value;
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
