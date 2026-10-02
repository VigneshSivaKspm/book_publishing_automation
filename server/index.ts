import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config, openaiConfigured } from "./config.ts";
import { log } from "./log.ts";
import { authorize, HttpError, sendError, sendJson } from "./http.ts";
import { diagnostics } from "./diagnostics.ts";
import { closeBrowser } from "./render/browser.ts";
import { documentRoutes, type Route } from "./routes.ts";
import { resumeInterruptedJobs } from "./pipeline/jobs.ts";

const routes: Route[] = [
  {
    method: "GET",
    pattern: /^\/api\/health$/,
    public: true,
    handler: async (_req, res) => sendJson(res, 200, { ok: true, openaiConfigured: openaiConfigured() }),
  },
  {
    method: "GET",
    pattern: /^\/api\/diagnostics$/,
    handler: async (_req, res, _m, url) => sendJson(res, 200, await diagnostics(url.searchParams.get("test") === "1")),
  },
  ...documentRoutes,
];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

/** In production the server also serves the built SPA from dist/. */
function serveStatic(urlPath: string, res: http.ServerResponse): boolean {
  const dist = path.join(config.root, "dist");
  if (!fs.existsSync(dist)) return false;
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, "");
  let file = path.join(dist, rel);
  if (!file.startsWith(dist)) return false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (!url.pathname.startsWith("/api/")) {
      if (req.method === "GET" && serveStatic(url.pathname, res)) return;
      throw new HttpError(404, "not_found", "Not found");
    }
    const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!route) throw new HttpError(404, "not_found", `No route for ${req.method} ${url.pathname}`);
    if (!route.public) authorize(req, url);
    const match = url.pathname.match(route.pattern)!;
    await route.handler(req, res, match, url);
  } catch (err) {
    if (!(err instanceof HttpError)) log("error", "http.unhandled", { path: url.pathname, error: String(err) });
    if (!res.headersSent) sendError(res, err);
    else res.end();
  }
});

server.listen(config.port, () => {
  log("info", "server.started", {
    port: config.port,
    openaiConfigured: openaiConfigured(),
    ocrModel: config.ocrModel,
    browser: config.browserPath ? path.basename(config.browserPath) : null,
    dataDir: config.dataDir,
  });
  resumeInterruptedJobs();
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await closeBrowser();
    process.exit(0);
  });
}
