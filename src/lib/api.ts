import type {
  BookModel,
  BookSettings,
  BookTypeChoice,
  JobStatus,
  PreflightReport,
  VersionInfo,
  VersionLabel,
} from "../../shared/model.ts";

/**
 * Browser client for the server pipeline. No provider credentials ever live
 * here: the browser only talks to /api (proxied by Vite in development).
 */

const TOKEN_KEY = "publication-studio.api-token";

export function getApiToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setApiToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the token simply is not remembered.
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const token = getApiToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

/** Append the access token to URLs loaded by <img>/<iframe>, which cannot send headers. */
export function withToken(url: string): string {
  const token = getApiToken();
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: headers(body !== undefined ? { "Content-Type": "application/json" } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Cannot reach the publishing server. Start it with “npm run server” and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON error page (e.g. dev proxy with server down).
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 502 || res.status === 504 || (!err && res.status >= 500)) {
      throw new ApiError(res.status, "server_down", "The publishing server is not running. Start it with “npm run server”.");
    }
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export interface DocumentSummary {
  documentId: string;
  name: string;
  bookType: string | null;
  state: string;
  pages: number;
  updatedAt: string | null;
}

export interface DocumentMetrics {
  sourcePages: number;
  failedPages: number;
  chapters: number;
  blocks: number;
  questions: number;
  questionNumbersMissing: number[];
  questionNumbersDuplicated: number[];
  answerKeyEntries: number;
  questionsWithAnswers: number;
  equations: number;
  equationIssues: number;
  tables: number;
  figures: number;
  meanConfidence: number | null;
  openIssues: number;
  blockingIssues: number;
}

export interface DocumentDetail {
  model: BookModel | null;
  settings: BookSettings;
  files: { file: string; originalName: string; kind: string; bytes: number }[];
  job: JobStatus | null;
  metrics: DocumentMetrics | null;
  versions: VersionInfo[];
  preflight: PreflightReport | null;
}

export interface Diagnostics {
  openai: { configured: boolean; reachable: boolean | null; models: Record<string, { name: string; available?: boolean; error?: string }>; error?: string | null };
  renderer: { browserFound: boolean; browserLaunches: boolean | null };
  pdfEngine: { mupdf: boolean };
  storage: { writable: boolean };
  database: { kind: string; available: boolean };
  queue: { kind: string; concurrency: number };
  limits: { maxUploadMb: number; maxPages: number };
  auth: { tokenRequired: boolean };
}

export const api = {
  diagnostics: (test: boolean) => request<Diagnostics>("GET", `/api/diagnostics${test ? "?test=1" : ""}`),
  list: () => request<{ documents: DocumentSummary[] }>("GET", "/api/documents"),
  create: (settings: Partial<BookSettings>) => request<{ documentId: string }>("POST", "/api/documents", { settings }),
  remove: (id: string) => request<{ ok: true }>("DELETE", `/api/documents/${id}`),
  get: (id: string) => request<DocumentDetail>("GET", `/api/documents/${id}`),
  saveSettings: (id: string, settings: Partial<BookSettings>) => request<{ settings: BookSettings }>("PUT", `/api/documents/${id}/settings`, { settings }),
  process: (id: string, bookType?: BookTypeChoice, forcePages?: number[]) => request<{ job: JobStatus }>("POST", `/api/documents/${id}/process`, { bookType, forcePages }),
  cancel: (id: string) => request<{ cancelled: boolean }>("POST", `/api/documents/${id}/cancel`),
  job: (id: string) => request<{ job: JobStatus | null; running: boolean }>("GET", `/api/documents/${id}/job`),
  saveModel: (id: string, model: BookModel) => request<{ model: BookModel; metrics: DocumentMetrics }>("PUT", `/api/documents/${id}/model`, { model }),
  saveVersion: (id: string, label: VersionLabel, note: string) => request<{ versions: VersionInfo[] }>("POST", `/api/documents/${id}/versions`, { label, note }),
  restoreVersion: (id: string, v: number) => request<{ model: BookModel; versions: VersionInfo[] }>("POST", `/api/documents/${id}/versions/${v}/restore`),
  exportPdf: (id: string) => request<{ preflight: PreflightReport; bytes: number }>("POST", `/api/documents/${id}/export`),
  recropFigure: (id: string, nodeId: string, page: number, bbox: { x: number; y: number; w: number; h: number }) =>
    request<{ model: BookModel }>("POST", `/api/documents/${id}/figure`, { nodeId, page, bbox }),

  async upload(id: string, file: File, onProgress?: (fraction: number) => void): Promise<void> {
    // XHR gives real upload progress for large scans.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/documents/${id}/files`);
      for (const [k, v] of Object.entries(headers({ "X-Filename": encodeURIComponent(file.name) }))) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = `Upload of ${file.name} failed (${xhr.status}).`;
        try {
          message = JSON.parse(xhr.responseText).error.message ?? message;
        } catch {
          /* keep default */
        }
        reject(new ApiError(xhr.status, "upload_failed", message));
      };
      xhr.onerror = () => reject(new ApiError(0, "network", "Upload failed: the publishing server is unreachable."));
      xhr.send(file);
    });
  },

  async uploadLogo(id: string, file: File): Promise<BookModel> {
    const res = await fetch(`/api/documents/${id}/logo`, { method: "POST", headers: headers(), body: file });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "Logo upload failed.");
    return data.model as BookModel;
  },

  pageImage: (id: string, n: number, kind: "image" | "thumb" | "original" = "image") => withToken(`/api/documents/${id}/pages/${n}/${kind}`),
  assetUrl: (id: string, assetId: string) => withToken(`/api/documents/${id}/assets/${assetId}`),
  previewUrl: (id: string, rev: number) => withToken(`/api/documents/${id}/book.html?rev=${rev}`),
  pdfUrl: (id: string) => withToken(`/api/documents/${id}/output/book.pdf`),
  exportUrl: (id: string, kind: "json" | "text") => withToken(`/api/documents/${id}/output/${kind}`),
};
