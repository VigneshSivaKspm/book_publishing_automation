import { useEffect, useState } from "react";
import type { NavHandler } from "../types";

export default function Settings({ onNavigate }: { onNavigate?: NavHandler }) {
  const [server, setServer] = useState<"checking" | "ok" | "no-key" | "down">("checking");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { openaiConfigured?: boolean }) => setServer(d.openaiConfigured ? "ok" : "no-key"))
      .catch(() => setServer("down"));
  }, []);
  const proxyConfigured = server === "ok";
  return <div className="h-full overflow-y-auto bg-slate-50">
    <header className="h-16 px-8 flex items-center border-b border-slate-200 bg-white"><div><h1 className="text-base font-semibold text-slate-950">Settings</h1><p className="text-xs text-slate-500">Local publishing and processing configuration</p></div>{onNavigate && <button onClick={() => onNavigate("dashboard")} className="ml-auto secondary-button">Back to Library</button>}</header>
    <main className="max-w-3xl p-8 space-y-5">
      <section className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-slate-900">Storage</h2><p className="mt-1 text-xs leading-5 text-slate-600">Publications and image assets are stored locally in IndexedDB. This workspace does not claim cloud sync; export project backups before clearing browser data or changing devices.</p></div><span className="status-badge status-good">Local mode</span></div></section>
      <section className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-slate-900">AI processing server</h2><p className="mt-1 text-xs leading-5 text-slate-600">OCR runs on the publishing server (<code>npm run server</code>), which holds OPENAI_API_KEY. Keys are never stored in this browser. {server === "down" ? "The server is not reachable at /api — imports fall back to local text extraction and Tesseract OCR." : server === "no-key" ? "The server is running but OPENAI_API_KEY is not set on it." : ""}</p></div><span className={`status-badge ${proxyConfigured ? "status-good" : "status-warning"}`}>{server === "checking" ? "Checking…" : proxyConfigured ? "Connected" : server === "no-key" ? "Key missing" : "Server offline"}</span></div></section>
      <section className="bg-white border border-slate-200 rounded-lg p-5"><h2 className="text-sm font-semibold text-slate-900">Production output</h2><p className="mt-1 text-xs leading-5 text-slate-600">The current real output is printable HTML using exact physical page dimensions and the browser’s Print / Save as PDF flow. PDF/X, CMYK conversion, ICC embedding, EPUB and press packages are not advertised because they are not implemented.</p></section>
    </main>
  </div>;
}
