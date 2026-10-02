import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import sharp from "sharp";
import { config } from "./config.ts";
import { HttpError, readBody, readJsonBody, sendJson } from "./http.ts";
import {
  deleteDocument,
  docDir,
  ensureDir,
  isValidId,
  listDocumentIds,
  listVersions,
  loadJob,
  loadModel,
  loadVersion,
  newId,
  readJson,
  sanitizeFilename,
  saveModel,
  saveVersion,
  writeJson,
} from "./storage.ts";
import { addSource, listSources, loadPageRecords } from "./ingest/index.ts";
import { cancelJob, isRunning, startJob } from "./pipeline/jobs.ts";
import { documentMetrics, refreshIssues } from "./pipeline/validate.ts";
import { buildBookHtml } from "./render/html.ts";
import { renderPdf, saveOutput } from "./render/pdf.ts";
import { runPreflight } from "./render/preflight.ts";
import { log } from "./log.ts";
import { extractPage } from "./openai/pageOcr.ts";
import { classifyError } from "./openai/client.ts";
import { extractionToLegacyText } from "./openai/legacyText.ts";
import { horizontalBands, toDataUrl } from "./ingest/image.ts";
import {
  defaultSettings,
  nodePlainText,
  type BookModel,
  type BookSettings,
  type BookTypeChoice,
  type PreflightReport,
  type VersionLabel,
} from "../shared/model.ts";

export interface Route {
  method: string;
  pattern: RegExp;
  public?: boolean;
  handler: (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray, url: URL) => Promise<void>;
}

const ID = "([a-z0-9][a-z0-9-]{5,63})";

function docId(m: RegExpMatchArray): string {
  const id = m[1];
  if (!isValidId(id) || !fs.existsSync(docDir(id))) throw new HttpError(404, "not_found", "Document not found.");
  return id;
}

function requireModel(id: string): BookModel {
  const model = loadModel(id);
  if (!model) throw new HttpError(409, "not_ready", "This document has not been processed yet.");
  return model;
}

function sendFile(res: ServerResponse, file: string, type: string, extraHeaders: Record<string, string> = {}): void {
  if (!fs.existsSync(file)) throw new HttpError(404, "not_found", "File not found.");
  res.writeHead(200, { "Content-Type": type, "Content-Length": fs.statSync(file).size, "Cache-Control": "private, max-age=60", ...extraHeaders });
  fs.createReadStream(file).pipe(res);
}

const STATIC_ROOTS: Record<string, string> = {
  katex: path.join(config.root, "node_modules", "katex", "dist"),
  fontsource: path.join(config.root, "node_modules", "@fontsource"),
};
const STATIC_TYPES: Record<string, string> = { ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };

const exporting = new Set<string>();

/** Partial-settings sanitizer: only known keys with correct primitive types. */
function cleanSettings(input: unknown, base: BookSettings): BookSettings {
  const out = { ...base };
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(k in base)) continue;
    const cur = (base as unknown as Record<string, unknown>)[k];
    if (typeof cur === "string" && typeof v === "string") (out as unknown as Record<string, unknown>)[k] = v.slice(0, 300);
    else if (typeof cur === "number" && typeof v === "number" && Number.isFinite(v)) (out as unknown as Record<string, unknown>)[k] = v;
    else if (typeof cur === "boolean" && typeof v === "boolean") (out as unknown as Record<string, unknown>)[k] = v;
    else if (Array.isArray(cur) && Array.isArray(v)) (out as unknown as Record<string, unknown>)[k] = v.filter((x) => typeof x === "string").slice(0, 10);
    else if (cur === null && (v === null || typeof v === "string")) (out as unknown as Record<string, unknown>)[k] = v;
  }
  if (!["REFERENCE_180_240", "A4", "A5", "CUSTOM"].includes(out.trim)) out.trim = "REFERENCE_180_240";
  out.customWidthMm = Math.min(500, Math.max(90, out.customWidthMm));
  out.customHeightMm = Math.min(700, Math.max(120, out.customHeightMm));
  out.watermarkOpacity = Math.min(0.3, Math.max(0.02, out.watermarkOpacity));
  return out;
}

function draftSettings(id: string): BookSettings {
  return defaultSettings(readJson<BookSettings>(docDir(id, "settings.json")) ?? {});
}

function bookHtml(model: BookModel, url: URL, interactive: boolean): string {
  const token = url.searchParams.get("token");
  return buildBookHtml(model, {
    assetBase: `/api/documents/${model.documentId}`,
    staticBase: "/api/static",
    token,
    interactive,
  });
}

export const documentRoutes: Route[] = [
  {
    method: "GET",
    pattern: /^\/api\/static\/(katex|fontsource)\/(.+)$/,
    public: true,
    handler: async (_req, res, m) => {
      const root = STATIC_ROOTS[m[1]];
      const file = path.normalize(path.join(root, decodeURIComponent(m[2])));
      if (!file.startsWith(root)) throw new HttpError(400, "bad_path", "Invalid path.");
      const type = STATIC_TYPES[path.extname(file)];
      if (!type) throw new HttpError(404, "not_found", "Not found.");
      sendFile(res, file, type, { "Cache-Control": "public, max-age=86400" });
    },
  },

  /* ---------- single-page OCR for the legacy in-editor importers ---------- */
  {
    method: "POST",
    pattern: /^\/api\/ocr\/page$/,
    handler: async (req, res) => {
      const body = await readJsonBody<{ image?: string; mode?: string; page?: number; totalPages?: number }>(req, 40 * 1024 * 1024);
      const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/s.exec(body.image ?? "");
      if (!m) throw new HttpError(400, "bad_image", "Send the page as a PNG/JPEG/WEBP data URL.");
      const mode = body.mode === "document" ? "document" : "qa";
      let png: Buffer;
      try {
        png = await sharp(Buffer.from(m[2], "base64")).rotate().flatten({ background: "#ffffff" }).png().toBuffer();
      } catch {
        throw new HttpError(415, "bad_image", "The page image could not be decoded.");
      }
      try {
        const { page, meta } = await extractPage(
          {
            fullPage: await toDataUrl(png, { maxWidth: 2000 }),
            bands: await horizontalBands(png),
            textLayer: null,
            pageNumber: Number(body.page) || 1,
            totalPages: Number(body.totalPages) || 1,
            bookTypeHint: mode === "qa" ? "question_bank" : "syllabus",
            previousTail: null,
            sectionState: null,
            correctionMode: false,
          },
          { page: Number(body.page) || 1 },
        );
        sendJson(res, 200, { text: extractionToLegacyText(page, mode), confidence: page.page_confidence, problems: meta.problems, extraction: page });
      } catch (err) {
        const f = classifyError(err);
        const status = f.code === "not_configured" ? 503 : f.code === "auth" ? 502 : f.code === "rate_limit" || f.code === "quota" ? 429 : 502;
        throw new HttpError(status, f.code, f.message);
      }
    },
  },

  /* ---------- documents ---------- */
  {
    method: "GET",
    pattern: /^\/api\/documents$/,
    handler: async (_req, res) => {
      const docs = listDocumentIds()
        .map((id) => {
          const model = loadModel(id);
          const job = loadJob(id);
          const settings = model?.settings ?? draftSettings(id);
          return {
            documentId: id,
            name: settings.bookName || settings.chapterName || listSources(id)[0]?.originalName || "Untitled",
            bookType: model?.bookType ?? null,
            state: job?.state ?? "draft",
            pages: model?.sourcePages.length ?? job?.pagesTotal ?? 0,
            updatedAt: model?.updatedAt ?? job?.updatedAt ?? null,
          };
        })
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      sendJson(res, 200, { documents: docs });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/documents$/,
    handler: async (req, res) => {
      const body = await readJsonBody<{ settings?: unknown }>(req);
      const id = newId("doc");
      ensureDir(docDir(id));
      writeJson(docDir(id, "settings.json"), cleanSettings(body.settings, defaultSettings()));
      sendJson(res, 201, { documentId: id });
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/api/documents/${ID}$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      if (isRunning(id)) throw new HttpError(409, "busy", "Cancel processing before deleting.");
      deleteDocument(id);
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/files$`),
    handler: async (req, res, m) => {
      const id = docId(m);
      if (isRunning(id)) throw new HttpError(409, "busy", "Processing is running; upload after it finishes.");
      const rawName = decodeURIComponent(String(req.headers["x-filename"] ?? "upload"));
      const buf = await readBody(req, config.maxUploadBytes);
      if (!buf.length) throw new HttpError(400, "empty", "The uploaded file is empty.");
      const rec = addSource(id, rawName, sanitizeFilename(rawName), buf);
      log("info", "upload", { documentId: id, kind: rec.kind, bytes: rec.bytes });
      sendJson(res, 201, { file: rec });
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/files$`),
    handler: async (_req, res, m) => sendJson(res, 200, { files: listSources(docId(m)) }),
  },
  {
    method: "PUT",
    pattern: new RegExp(`^/api/documents/${ID}/settings$`),
    handler: async (req, res, m) => {
      const id = docId(m);
      const body = await readJsonBody<{ settings: unknown }>(req);
      const model = loadModel(id);
      const settings = cleanSettings(body.settings, model?.settings ?? draftSettings(id));
      writeJson(docDir(id, "settings.json"), settings);
      if (model) {
        model.settings = settings;
        saveModel(model);
      }
      sendJson(res, 200, { settings });
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/process$`),
    handler: async (req, res, m) => {
      const id = docId(m);
      const body = await readJsonBody<{ bookType?: BookTypeChoice; forcePages?: number[] }>(req);
      const previous = readJson<{ choice?: BookTypeChoice }>(docDir(id, "job-request.json"));
      const choice: BookTypeChoice =
        body.bookType === "syllabus" || body.bookType === "question_bank" || body.bookType === "auto" ? body.bookType : (previous?.choice ?? "auto");
      if (!listSources(id).length) throw new HttpError(400, "no_files", "Upload at least one file first.");
      const settings = draftSettings(id);
      const job = startJob(id, { choice, settings, forcePages: (body.forcePages ?? []).filter((n) => Number.isInteger(n) && n > 0) });
      sendJson(res, 202, { job });
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/cancel$`),
    handler: async (_req, res, m) => sendJson(res, 200, { cancelled: cancelJob(docId(m)) }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/job$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      sendJson(res, 200, { job: loadJob(id), running: isRunning(id) });
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      const model = loadModel(id);
      sendJson(res, 200, {
        model,
        settings: model?.settings ?? draftSettings(id),
        files: listSources(id),
        job: loadJob(id),
        metrics: model ? documentMetrics(model) : null,
        versions: listVersions(id),
        preflight: readJson<PreflightReport>(docDir(id, "output", "preflight.json")),
        pages: model ? null : loadPageRecords(id).map((p) => ({ index: p.index, method: p.method, thumbnail: p.thumbnail })),
      });
    },
  },
  {
    method: "PUT",
    pattern: new RegExp(`^/api/documents/${ID}/model$`),
    handler: async (req, res, m) => {
      const id = docId(m);
      const current = requireModel(id);
      const body = await readJsonBody<{ model: BookModel }>(req, 50 * 1024 * 1024);
      const next = body.model;
      if (!next || next.documentId !== id || !Array.isArray(next.chapters) || !Array.isArray(next.issues)) {
        throw new HttpError(400, "bad_model", "Invalid book model.");
      }
      // Server-owned fields cannot be changed by the client.
      next.sourcePages = current.sourcePages;
      next.assets = current.assets.concat(next.assets.filter((a) => !current.assets.some((c) => c.id === a.id) && fs.existsSync(docDir(id, "assets", a.file))));
      next.settings = cleanSettings(next.settings, current.settings);
      next.schemaVersion = 1;
      if (!["syllabus", "question_bank"].includes(next.bookType)) next.bookType = current.bookType;
      refreshIssues(next);
      saveModel(next);
      sendJson(res, 200, { model: next, metrics: documentMetrics(next) });
    },
  },

  /* ---------- versions ---------- */
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/versions$`),
    handler: async (req, res, m) => {
      const id = docId(m);
      const body = await readJsonBody<{ label?: VersionLabel; note?: string }>(req);
      const label: VersionLabel = body.label === "approved" || body.label === "final" ? body.label : "draft";
      const info = saveVersion(requireModel(id), label, body.note ?? "");
      sendJson(res, 201, { version: info, versions: listVersions(id) });
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/versions/(\\d+)/restore$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      const v = loadVersion(id, Number(m[2]));
      if (!v) throw new HttpError(404, "not_found", "Version not found.");
      saveVersion(requireModel(id), "draft", `Auto-backup before restoring v${m[2]}`);
      saveModel(v);
      sendJson(res, 200, { model: v, versions: listVersions(id) });
    },
  },

  /* ---------- page images & assets ---------- */
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/pages/(\\d+)/(image|thumb|original)$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      const n = Number(m[2]);
      if (m[3] === "thumb") return sendFile(res, docDir(id, "pages", `${n}.thumb.jpg`), "image/jpeg");
      if (m[3] === "original" && fs.existsSync(docDir(id, "pages", `${n}.orig.png`))) return sendFile(res, docDir(id, "pages", `${n}.orig.png`), "image/png");
      sendFile(res, docDir(id, "pages", `${n}.png`), "image/png");
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/assets/([a-z0-9_]{4,40})$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      const model = requireModel(id);
      const asset = model.assets.find((a) => a.id === m[2]);
      if (!asset) throw new HttpError(404, "not_found", "Asset not found.");
      sendFile(res, docDir(id, "assets", asset.file), "image/png");
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/logo$`),
    handler: async (req, res, m) => {
      const id = docId(m);
      const model = requireModel(id);
      const buf = await readBody(req, 15 * 1024 * 1024);
      let png: Buffer;
      try {
        png = await sharp(buf).rotate().png().toBuffer();
      } catch {
        throw new HttpError(415, "bad_image", "The logo must be a PNG, JPG or WEBP image.");
      }
      const meta = await sharp(png).metadata();
      const assetId = `logo_${Date.now().toString(36)}`;
      ensureDir(docDir(id, "assets"));
      fs.writeFileSync(docDir(id, "assets", `${assetId}.png`), png);
      model.assets.push({ id: assetId, kind: "logo", file: `${assetId}.png`, widthPx: meta.width ?? 0, heightPx: meta.height ?? 0, dpi: 300, sourcePage: null, bbox: null });
      model.settings.watermarkAssetId = assetId;
      model.settings.watermarkEnabled = true;
      saveModel(model);
      sendJson(res, 201, { assetId, model });
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/figure$`),
    handler: async (req, res, m) => {
      // Replace a figure crop with a user-adjusted crop of the source page.
      const id = docId(m);
      const model = requireModel(id);
      const body = await readJsonBody<{ nodeId: string; page: number; bbox: { x: number; y: number; w: number; h: number } }>(req);
      const node = model.chapters.flatMap((c) => c.nodes).find((n) => n.id === body.nodeId);
      if (!node || (node.kind !== "figure" && node.kind !== "question")) throw new HttpError(404, "not_found", "Figure node not found.");
      const { x, y, w, h } = body.bbox ?? ({} as never);
      if (![x, y, w, h].every((v) => typeof v === "number" && v >= 0 && v <= 1) || w < 0.01 || h < 0.01) throw new HttpError(400, "bad_bbox", "Invalid crop box.");
      const src = docDir(id, "pages", `${Number(body.page)}.png`);
      if (!fs.existsSync(src)) throw new HttpError(404, "not_found", "Source page not found.");
      const png = fs.readFileSync(src);
      const meta = await sharp(png).metadata();
      const left = Math.round(x * meta.width!);
      const top = Math.round(y * meta.height!);
      const crop = await sharp(png).extract({ left, top, width: Math.min(meta.width! - left, Math.round(w * meta.width!)), height: Math.min(meta.height! - top, Math.round(h * meta.height!)) }).png().toBuffer({ resolveWithObject: true });
      const assetId = `asset_u${Date.now().toString(36)}`;
      fs.writeFileSync(docDir(id, "assets", `${assetId}.png`), crop.data);
      const rec = loadPageRecords(id).find((p) => p.index === Number(body.page));
      model.assets.push({ id: assetId, kind: "figure", file: `${assetId}.png`, widthPx: crop.info.width, heightPx: crop.info.height, dpi: rec?.dpi ?? 300, sourcePage: Number(body.page), bbox: body.bbox });
      if (node.kind === "figure") node.assetId = assetId;
      else node.figureAssetId = assetId;
      node.verified = true;
      refreshIssues(model);
      saveModel(model);
      sendJson(res, 200, { model });
    },
  },

  /* ---------- preview / export ---------- */
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/book\\.html$`),
    handler: async (_req, res, m, url) => {
      const model = requireModel(docId(m));
      const html = bookHtml(model, url, url.searchParams.get("mode") !== "print");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "SAMEORIGIN" });
      res.end(html);
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/documents/${ID}/export$`),
    handler: async (req, res, m, url) => {
      const id = docId(m);
      if (exporting.has(id)) throw new HttpError(409, "busy", "An export is already running for this document.");
      exporting.add(id);
      try {
        const model = requireModel(id);
        const token = config.accessToken ? `&token=${encodeURIComponent(config.accessToken)}` : "";
        const started = Date.now();
        const { pdf, report } = await renderPdf(model, `http://127.0.0.1:${config.port}/api/documents/${id}/book.html?mode=print${token}`);
        saveOutput(id, pdf, report);
        const preflight = runPreflight(pdf, report, model);
        writeJson(docDir(id, "output", "preflight.json"), preflight);
        log("info", "export", { documentId: id, pages: preflight.pageCount, ready: preflight.readyForPrint, ms: Date.now() - started });
        void req;
        void url;
        sendJson(res, 200, { preflight, bytes: pdf.length });
      } finally {
        exporting.delete(id);
      }
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/output/book\\.pdf$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      const model = requireModel(id);
      const name = sanitizeFilename(`${model.settings.bookName || "book"}.pdf`).replace(/"/g, "");
      sendFile(res, docDir(id, "output", "book.pdf"), "application/pdf", { "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"` });
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/api/documents/${ID}/output/(json|text)$`),
    handler: async (_req, res, m) => {
      const id = docId(m);
      const model = requireModel(id);
      if (m[2] === "json") {
        res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="book-${id}.json"` });
        res.end(JSON.stringify(model, null, 2));
        return;
      }
      const text = model.chapters
        .map((c) => [`${c.number ? `Chapter ${c.number}: ` : ""}${c.title}`, ...c.nodes.map(nodePlainText)].join("\n\n"))
        .join("\n\n\n");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="book-${id}.txt"` });
      res.end(text);
    },
  },
];
