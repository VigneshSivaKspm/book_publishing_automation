import OpenAI from "openai";
import { config, openaiConfigured } from "../config.ts";
import { log } from "../log.ts";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiConfigured()) {
    throw new ApiFailure("not_configured", "OpenAI API key is not configured on the server (OPENAI_API_KEY).", false);
  }
  if (!client) {
    // Retries are handled by callWithRetry so every attempt is logged.
    client = new OpenAI({ apiKey: config.openaiApiKey, baseURL: config.openaiBaseUrl, maxRetries: 0, timeout: config.ocrTimeoutMs });
  }
  return client;
}

/** Reasoning parameters are only accepted by reasoning-capable models. */
export function reasoningFor(model: string): { reasoning?: { effort: typeof config.reasoningEffort } } {
  return /^(gpt-5|o\d)/i.test(model) ? { reasoning: { effort: config.reasoningEffort } } : {};
}

export type FailureCode =
  | "not_configured"
  | "auth"
  | "rate_limit"
  | "quota"
  | "timeout"
  | "server"
  | "bad_request"
  | "model_not_found"
  | "incomplete"
  | "refusal"
  | "invalid_output"
  | "network"
  | "unknown";

export class ApiFailure extends Error {
  code: FailureCode;
  retryable: boolean;
  retryAfterMs: number | null;
  constructor(code: FailureCode, message: string, retryable: boolean, retryAfterMs: number | null = null) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfter(headers: unknown): number | null {
  const h = headers as { get?: (k: string) => string | null } | undefined;
  const ms = h?.get?.("retry-after-ms");
  if (ms && Number.isFinite(Number(ms))) return Number(ms);
  const s = h?.get?.("retry-after");
  if (s && Number.isFinite(Number(s))) return Number(s) * 1000;
  return null;
}

/** Map any thrown error into a sanitized, classified ApiFailure. */
export function classifyError(err: unknown): ApiFailure {
  if (err instanceof ApiFailure) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return new ApiFailure("timeout", "OpenAI request timed out.", true);
  if (err instanceof OpenAI.APIConnectionError) return new ApiFailure("network", "Could not reach the OpenAI API (network error).", true);
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    const code = (err as { code?: string | null }).code ?? "";
    const after = retryAfter(err.headers);
    if (status === 401) return new ApiFailure("auth", "OpenAI API authentication failed. Check OPENAI_API_KEY in the server configuration.", false);
    if (status === 403) return new ApiFailure("auth", "OpenAI API access denied for this key/project.", false);
    if (status === 404 || code === "model_not_found") return new ApiFailure("model_not_found", `OpenAI model not available: ${sanitize(err.message)}`, false);
    if (status === 429 && code === "insufficient_quota") return new ApiFailure("quota", "OpenAI quota exhausted for this account.", false);
    if (status === 429) return new ApiFailure("rate_limit", "OpenAI rate limit reached.", true, after);
    if (status >= 500) return new ApiFailure("server", `OpenAI server error (${status}).`, true, after);
    if (status === 400) return new ApiFailure("bad_request", `OpenAI rejected the request: ${sanitize(err.message)}`, false);
    return new ApiFailure("unknown", `OpenAI error ${status}: ${sanitize(err.message)}`, status >= 500);
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/abort|timed? ?out/i.test(msg)) return new ApiFailure("timeout", "OpenAI request timed out.", true);
  return new ApiFailure("unknown", sanitize(msg), false);
}

function sanitize(msg: string): string {
  return msg.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***").slice(0, 300);
}

export interface RetryContext {
  jobId?: string;
  documentId?: string;
  page?: number;
  task: string;
  model: string;
  maxAttempts?: number;
  onRetry?: (info: { attempt: number; waitMs: number; failure: ApiFailure }) => void;
}

/** Exponential backoff with jitter, honouring Retry-After. Logs every attempt. */
export async function callWithRetry<T>(ctx: RetryContext, fn: (attempt: number) => Promise<T>): Promise<T> {
  const max = ctx.maxAttempts ?? config.ocrMaxAttempts;
  let last: ApiFailure | null = null;
  for (let attempt = 1; attempt <= max; attempt++) {
    const started = Date.now();
    try {
      const result = await fn(attempt);
      log("info", "openai.request", { ...base(ctx), attempt, ms: Date.now() - started, ok: true });
      return result;
    } catch (err) {
      const failure = classifyError(err);
      last = failure;
      log("warn", "openai.request", { ...base(ctx), attempt, ms: Date.now() - started, ok: false, code: failure.code, error: failure.message });
      if (!failure.retryable || attempt === max) break;
      const backoff = Math.min(60_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 750);
      const waitMs = Math.max(backoff, failure.retryAfterMs ?? 0);
      ctx.onRetry?.({ attempt, waitMs, failure });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw last ?? new ApiFailure("unknown", "Request failed", false);
}

function base(ctx: RetryContext) {
  return { task: ctx.task, model: ctx.model, jobId: ctx.jobId, documentId: ctx.documentId, page: ctx.page };
}
