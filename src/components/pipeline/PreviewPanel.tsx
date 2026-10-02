import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

interface Report {
  pages: number;
  overflows: unknown[];
  clipped: unknown[];
  katexErrors: number;
  lowRes: unknown[];
}

/**
 * Paginated book preview. The iframe loads the exact HTML the PDF renderer
 * prints, so page breaks, columns, fonts and math are identical.
 */
export default function PreviewPanel({ documentId, revision, onOpenNode }: { documentId: string; revision: number; onOpenNode: (nodeId: string) => void }) {
  const [zoom, setZoom] = useState(0.8);
  const [report, setReport] = useState<Report | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "book-paginated") setReport(e.data.report);
      if (e.data?.type === "book-node-click") onOpenNode(e.data.nodeId);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onOpenNode]);

  useEffect(() => setReport(null), [revision]);

  const problems = report ? report.overflows.length + report.clipped.length + report.katexErrors : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs">
        <span className="font-semibold text-slate-700">{report ? `${report.pages} pages` : "Laying out pages…"}</span>
        {report && (problems ? <span className="status-badge status-error">{problems} layout problem(s) — see Export preflight</span> : <span className="status-badge status-good">No layout problems</span>)}
        <span className="text-[11px] text-slate-500">Click any block to proof it against the source.</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="icon-button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
            −
          </button>
          <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="icon-button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
            +
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-slate-400">
        <iframe ref={frame} key={revision} title="Book preview" src={api.previewUrl(documentId, revision)} className="h-full w-full border-0" style={{ zoom }} />
      </div>
    </div>
  );
}
