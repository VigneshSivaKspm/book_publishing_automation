import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { config } from "./config.ts";

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(data);
}

export function sendError(res: ServerResponse, err: unknown): void {
  if (err instanceof HttpError) return sendJson(res, err.status, { error: { code: err.code, message: err.message } });
  const message = err instanceof Error ? err.message : String(err);
  sendJson(res, 500, { error: { code: "internal", message: message.slice(0, 300) } });
}

/** Read a request body up to `limit` bytes. */
export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > limit) throw new HttpError(413, "too_large", `Upload exceeds the ${Math.round(limit / 1048576)} MB limit.`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, "too_large", `Upload exceeds the ${Math.round(limit / 1048576)} MB limit.`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody<T>(req: IncomingMessage, limit = 20 * 1024 * 1024): Promise<T> {
  const buf = await readBody(req, limit);
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    throw new HttpError(400, "bad_json", "Request body is not valid JSON.");
  }
}

/** Optional bearer-token gate (APP_ACCESS_TOKEN). Constant-time comparison. */
export function authorize(req: IncomingMessage, url: URL): void {
  if (!config.accessToken) return;
  const header = req.headers.authorization ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : url.searchParams.get("token") ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(config.accessToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, "unauthorized", "Missing or invalid access token.");
}
