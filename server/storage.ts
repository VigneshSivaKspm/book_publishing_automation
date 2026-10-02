import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.ts";
import type { BookModel, JobStatus, VersionInfo, VersionLabel } from "../shared/model.ts";

/**
 * File-system storage. Layout:
 *   data/cache/extract/<pageHash>-<settingsHash>.json   OCR cache (shared across documents)
 *   data/documents/<id>/sources/                         uploaded originals
 *   data/documents/<id>/pages/<n>.png|.thumb.jpg|.json   normalized pages + extraction
 *   data/documents/<id>/assets/                          figures, logos
 *   data/documents/<id>/model.json                       editable BookModel
 *   data/documents/<id>/versions/                        saved revisions
 *   data/documents/<id>/job.json                         durable job state
 *   data/documents/<id>/output/                          preview html, pdf, preflight
 */

const ID_RE = /^[a-z0-9][a-z0-9-]{5,63}$/;

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(9).toString("hex")}`;
}

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

export function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function docDir(documentId: string, ...parts: string[]): string {
  if (!isValidId(documentId)) throw new Error("Invalid document id");
  for (const p of parts) {
    if (p.includes("..") || path.isAbsolute(p)) throw new Error("Invalid path segment");
  }
  return path.join(config.dataDir, "documents", documentId, ...parts);
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Atomic JSON write: temp file + rename so a crash never leaves half a file. */
export function writeJson(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).normalize("NFKC");
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "upload").slice(0, 120);
}

/* ---------------- documents ---------------- */

export function listDocumentIds(): string[] {
  const dir = path.join(config.dataDir, "documents");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(isValidId);
}

export function loadModel(documentId: string): BookModel | null {
  return readJson<BookModel>(docDir(documentId, "model.json"));
}

export function saveModel(model: BookModel): void {
  model.updatedAt = new Date().toISOString();
  writeJson(docDir(model.documentId, "model.json"), model);
}

export function loadJob(documentId: string): JobStatus | null {
  return readJson<JobStatus>(docDir(documentId, "job.json"));
}

export function saveJob(job: JobStatus): void {
  job.updatedAt = new Date().toISOString();
  writeJson(docDir(job.documentId, "job.json"), job);
}

export function listVersions(documentId: string): VersionInfo[] {
  return readJson<VersionInfo[]>(docDir(documentId, "versions", "index.json")) ?? [];
}

export function saveVersion(model: BookModel, label: VersionLabel, note: string): VersionInfo {
  const versions = listVersions(model.documentId);
  const info: VersionInfo = {
    version: (versions.at(-1)?.version ?? 0) + 1,
    label,
    note: note.slice(0, 200),
    createdAt: new Date().toISOString(),
  };
  writeJson(docDir(model.documentId, "versions", `${info.version}.json`), model);
  writeJson(docDir(model.documentId, "versions", "index.json"), [...versions, info]);
  return info;
}

export function loadVersion(documentId: string, version: number): BookModel | null {
  if (!Number.isInteger(version) || version < 1) return null;
  return readJson<BookModel>(docDir(documentId, "versions", `${version}.json`));
}

export function deleteDocument(documentId: string): void {
  fs.rmSync(docDir(documentId), { recursive: true, force: true });
}

/* ---------------- extraction cache ---------------- */

export function cachePath(key: string): string {
  if (!/^[a-f0-9]{16,128}$/.test(key)) throw new Error("Invalid cache key");
  return path.join(config.dataDir, "cache", "extract", `${key}.json`);
}
