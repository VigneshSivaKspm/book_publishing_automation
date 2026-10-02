import { useState } from "react";
import Icon from "../Icon";
import { api, type DocumentDetail } from "../../lib/api";
import type { BookModel, PreflightReport, VersionInfo, VersionLabel } from "../../../shared/model.ts";

export default function ExportPanel({
  documentId,
  detail,
  dirty,
  onSaveFirst,
  onRestored,
}: {
  documentId: string;
  detail: DocumentDetail;
  dirty: boolean;
  onSaveFirst: () => Promise<void>;
  onRestored: (m: BookModel) => void;
}) {
  const [report, setReport] = useState<PreflightReport | null>(detail.preflight);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>(detail.versions);
  const [note, setNote] = useState("");
  const m = detail.metrics;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (dirty) await onSaveFirst();
      const r = await api.exportPdf(documentId);
      setReport(r.preflight);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const snapshot = async (label: VersionLabel) => {
    if (dirty) await onSaveFirst();
    const r = await api.saveVersion(documentId, label, note);
    setVersions(r.versions);
    setNote("");
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto grid max-w-5xl grid-cols-[1.4fr_1fr] gap-6 p-6">
        <section>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Print PDF</h2>
            <button className="ml-auto h-9 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" onClick={run} disabled={busy}>
              {busy ? "Typesetting & checking…" : report ? "Re-generate PDF" : "Generate print PDF"}
            </button>
          </div>
          {error && (
            <div role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          {report && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">PDF pre-flight</span>
                <span className="text-[11px] text-slate-400">{report.pageCount} pages · {new Date(report.generatedAt).toLocaleString()}</span>
                <span className={`ml-auto status-badge ${report.readyForPrint ? "status-good" : "status-error"}`}>{report.readyForPrint ? "READY FOR PRINT" : "NOT READY FOR PRINT"}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {report.checks.map((c) => (
                    <tr key={c.name} className="border-b border-slate-100 last:border-0">
                      <td className="w-48 px-4 py-2 font-medium text-slate-700">{c.name}</td>
                      <td className="px-2 py-2">
                        <span className={`status-badge ${c.status === "pass" ? "status-good" : c.status === "warn" ? "status-warning" : "status-error"}`}>{c.status.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3">
                <a className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-700" href={api.pdfUrl(documentId)}>
                  <Icon name="export" className="h-4 w-4" /> Download print PDF
                </a>
                {!report.readyForPrint && <span className="self-center text-[11px] text-rose-600">The PDF is a proof until every blocking check passes.</span>}
              </div>
            </div>
          )}
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-slate-700">Other exports</h3>
            <div className="mt-2 flex gap-2">
              <a className="h-8 rounded border border-slate-300 px-3 text-xs font-semibold leading-8 hover:bg-slate-50" href={api.exportUrl(documentId, "json")}>
                Structured JSON
              </a>
              <a className="h-8 rounded border border-slate-300 px-3 text-xs font-semibold leading-8 hover:bg-slate-50" href={api.exportUrl(documentId, "text")}>
                OCR text
              </a>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          {m && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs">
              <h3 className="mb-2 font-semibold text-slate-700">Content checks</h3>
              <dl className="grid grid-cols-2 gap-y-1.5">
                <dt className="text-slate-500">Source pages</dt>
                <dd>
                  {m.sourcePages}
                  {m.failedPages ? <span className="text-rose-600"> ({m.failedPages} failed)</span> : ""}
                </dd>
                <dt className="text-slate-500">Content blocks</dt>
                <dd>{m.blocks}</dd>
                {m.questions > 0 && (
                  <>
                    <dt className="text-slate-500">Questions</dt>
                    <dd>{m.questions}</dd>
                    <dt className="text-slate-500">Missing numbers</dt>
                    <dd className={m.questionNumbersMissing.length ? "text-amber-700" : ""}>{m.questionNumbersMissing.length ? m.questionNumbersMissing.slice(0, 12).join(", ") + (m.questionNumbersMissing.length > 12 ? "…" : "") : "none"}</dd>
                    <dt className="text-slate-500">Duplicates</dt>
                    <dd className={m.questionNumbersDuplicated.length ? "text-rose-700" : ""}>{m.questionNumbersDuplicated.join(", ") || "none"}</dd>
                    <dt className="text-slate-500">Answer key</dt>
                    <dd>
                      {m.questionsWithAnswers}/{m.questions} answered
                    </dd>
                  </>
                )}
                <dt className="text-slate-500">Equations / tables / figures</dt>
                <dd>
                  {m.equations} / {m.tables} / {m.figures}
                </dd>
                <dt className="text-slate-500">Mean OCR confidence</dt>
                <dd>{m.meanConfidence != null ? `${Math.round(m.meanConfidence * 100)}%` : "–"}</dd>
                <dt className="text-slate-500">Open issues</dt>
                <dd className={m.blockingIssues ? "text-rose-700" : ""}>
                  {m.openIssues} ({m.blockingIssues} blocking)
                </dd>
              </dl>
            </section>
          )}
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs">
            <h3 className="mb-2 font-semibold text-slate-700">Versions</h3>
            <input className="mb-2 h-8 w-full rounded border border-slate-300 px-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mb-3 flex gap-1.5">
              <button className="h-8 flex-1 rounded border border-slate-300 font-semibold hover:bg-slate-50" onClick={() => snapshot("draft")}>
                Save draft
              </button>
              <button className="h-8 flex-1 rounded border border-emerald-300 bg-emerald-50 font-semibold text-emerald-800" onClick={() => snapshot("approved")}>
                Approve
              </button>
              <button className="h-8 flex-1 rounded border border-indigo-300 bg-indigo-50 font-semibold text-indigo-800" onClick={() => snapshot("final")}>
                Final print
              </button>
            </div>
            <ul className="max-h-60 space-y-1 overflow-auto">
              {versions
                .slice()
                .reverse()
                .map((v) => (
                  <li key={v.version} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
                    <span className="font-mono text-slate-400">v{v.version}</span>
                    <span className={`status-badge ${v.label === "final" ? "bg-indigo-50 text-indigo-700" : v.label === "approved" ? "status-good" : "bg-slate-100 text-slate-600"}`}>{v.label}</span>
                    <span className="flex-1 truncate text-slate-600" title={v.note}>
                      {v.note || new Date(v.createdAt).toLocaleString()}
                    </span>
                    <button
                      className="font-semibold text-indigo-600"
                      onClick={async () => {
                        if (!window.confirm(`Restore version ${v.version}? The current state is backed up first.`)) return;
                        const r = await api.restoreVersion(documentId, v.version);
                        setVersions(r.versions);
                        onRestored(r.model);
                      }}
                    >
                      Restore
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
