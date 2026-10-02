import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { JobStage, JobStatus } from "../../../shared/model.ts";

const STAGES: { id: JobStage; label: string }[] = [
  { id: "analyzing", label: "Analyzing document" },
  { id: "rendering_pages", label: "Rendering pages" },
  { id: "extracting", label: "Extracting text, structure, equations & tables" },
  { id: "precision_pass", label: "Precision pass (formulas, tables, unclear text)" },
  { id: "building_book", label: "Building book" },
  { id: "validating", label: "Validating" },
  { id: "done", label: "Completed" },
];

/** Polls the durable job on the server; safe to leave and come back. */
export default function JobPanel({ documentId, onFinished }: { documentId: string; onFinished: () => void }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const tick = async () => {
      try {
        const r = await api.job(documentId);
        if (stop) return;
        setJob(r.job);
        setRunning(r.running);
        setError(null);
        if (!r.running && r.job && ["completed", "needs_review"].includes(r.job.state)) {
          onFinished();
          return;
        }
      } catch (err) {
        if (!stop) setError((err as Error).message);
      }
      timer = window.setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [documentId, onFinished]);

  const stageIdx = job ? STAGES.findIndex((s) => s.id === job.stage) : -1;
  const pct = job && job.pagesTotal ? Math.round(((job.pagesDone + job.pagesFailed) / job.pagesTotal) * 100) : 0;
  const failed = job?.state === "failed";

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-lg font-semibold text-slate-900">{failed ? "Processing failed" : job?.state === "cancelled" ? "Processing cancelled" : "Processing document"}</h2>
      <p className="mt-1 text-xs text-slate-500" aria-live="polite">
        {job?.message ?? "Connecting…"}
      </p>
      {job && job.pagesTotal > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>
              {job.pagesDone} of {job.pagesTotal} pages extracted{job.pagesFailed ? ` · ${job.pagesFailed} failed` : ""}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${job.pagesFailed ? "bg-amber-500" : "bg-indigo-600"} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <ol className="mt-6 space-y-2">
        {STAGES.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${i < stageIdx || job?.stage === "done" ? "bg-emerald-500" : i === stageIdx && !failed ? "animate-pulse bg-indigo-500" : "bg-slate-300"}`} />
            <span className={i === stageIdx ? "font-semibold text-slate-900" : "text-slate-500"}>{s.label}</span>
          </li>
        ))}
      </ol>
      {(error || job?.error) && (
        <div role="alert" className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {job?.error ?? error}
        </div>
      )}
      <div className="mt-6 flex gap-2">
        {running && (
          <button className="h-9 rounded-md border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => api.cancel(documentId)}>
            Cancel
          </button>
        )}
        {!running && (failed || job?.state === "cancelled") && (
          <button className="h-9 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500" onClick={() => api.process(documentId, "auto").then(() => setRunning(true))}>
            Resume (finished pages are kept)
          </button>
        )}
      </div>
      {job && job.events.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">Activity log ({job.events.length})</summary>
          <ul className="mt-2 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white p-2 font-mono text-[10.5px] leading-5">
            {job.events
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i} className={e.level === "error" ? "text-rose-700" : e.level === "warn" ? "text-amber-700" : "text-slate-600"}>
                  {new Date(e.at).toLocaleTimeString()} {e.message}
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
