import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import NewDocumentFlow from "../components/pipeline/NewDocumentFlow";
import JobPanel from "../components/pipeline/JobPanel";
import ReviewPanel from "../components/pipeline/ReviewPanel";
import PreviewPanel from "../components/pipeline/PreviewPanel";
import ExportPanel from "../components/pipeline/ExportPanel";
import SettingsForm from "../components/pipeline/SettingsForm";
import { api, getApiToken, setApiToken, type Diagnostics, type DocumentDetail, type DocumentSummary } from "../lib/api";
import { modelToBookDocument } from "../lib/modelBridge";
import type { BookDocument } from "../types";
import type { BookModel, BookType } from "../../shared/model.ts";

type View = { kind: "list" } | { kind: "new" } | { kind: "doc"; id: string };
type Tab = "review" | "preview" | "export" | "settings";

function StatusBanner() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [token, setToken] = useState(getApiToken());
  const load = useCallback(async (test = false) => {
    setTesting(test);
    try {
      setDiag(await api.diagnostics(test));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }, []);
  useEffect(() => void load(false), [load]);

  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-800">
        <Icon name="warning" className="h-4 w-4" /> {error}
        {/token/i.test(error) && (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              setApiToken(token);
              void load(false);
            }}
          >
            <input className="h-7 rounded border border-rose-300 px-2" type="password" placeholder="Access token" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="h-7 rounded bg-rose-700 px-2 font-semibold text-white">Use token</button>
          </form>
        )}
        <button className="ml-auto font-semibold underline" onClick={() => load(false)}>
          Retry
        </button>
      </div>
    );
  if (!diag) return null;
  const okAi = diag.openai.configured && diag.openai.reachable !== false;
  return (
    <div className={`flex flex-wrap items-center gap-4 border-b px-6 py-1.5 text-[11px] ${okAi ? "border-slate-200 bg-white text-slate-500" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <span>
        OpenAI: <b>{!diag.openai.configured ? "not configured (set OPENAI_API_KEY on the server)" : diag.openai.reachable === null ? "configured" : diag.openai.reachable ? "connected" : `error — ${diag.openai.error}`}</b>
      </span>
      {diag.openai.models.ocr && <span>OCR model: {diag.openai.models.ocr.name}{diag.openai.models.ocr.available === false ? " (unavailable)" : ""}</span>}
      <span>PDF renderer: {diag.renderer.browserFound ? "ready" : "browser missing (set CHROME_PATH)"}</span>
      <span>Storage: {diag.storage.writable ? "ok" : "not writable"}</span>
      <button className="ml-auto font-semibold text-indigo-700 underline disabled:opacity-50" disabled={testing} onClick={() => load(true)}>
        {testing ? "Testing…" : "Test connection"}
      </button>
    </div>
  );
}

function DocumentList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .list()
      .then((r) => setDocs(r.documents))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const stateBadge = (s: string) =>
    s === "completed" ? "status-good" : s === "needs_review" ? "status-warning" : s === "failed" ? "status-error" : "bg-slate-100 text-slate-600";
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Scanned & imported books</h2>
          <p className="text-xs text-slate-500">Upload → OCR & structure → review → paginated preview → print PDF.</p>
        </div>
        <button className="ml-auto inline-flex h-9 items-center gap-2 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500" onClick={onNew}>
          <Icon name="plus" className="h-4 w-4" /> New book from files
        </button>
      </div>
      {error && <p className="mt-4 text-xs text-rose-700">{error}</p>}
      {docs && docs.length === 0 && <p className="mt-10 text-center text-sm text-slate-500">No books yet. Upload a PDF, scans or a Word file to start.</p>}
      {docs && docs.length > 0 && (
        <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
          <thead className="bg-slate-50 text-left text-[11px] text-slate-500">
            <tr>
              <th className="px-4 py-2">Book</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Pages</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.documentId} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40" onClick={() => onOpen(d.documentId)}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{d.name}</td>
                <td className="px-2">{d.bookType === "question_bank" ? "Question bank" : d.bookType === "syllabus" ? "Syllabus" : "–"}</td>
                <td className="px-2">{d.pages || "–"}</td>
                <td className="px-2">
                  <span className={`status-badge ${stateBadge(d.state)}`}>{d.state.replace("_", " ")}</span>
                </td>
                <td className="px-2 text-slate-500">{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : "–"}</td>
                <td className="px-2 text-right">
                  <button
                    className="icon-button text-rose-600"
                    aria-label={`Delete ${d.name}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm(`Delete "${d.name}" and all its pages, OCR results and exports?`)) return;
                      await api.remove(d.documentId).catch((err) => window.alert(err.message));
                      load();
                    }}
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Workspace({ id, onBack, onOpenInEditor }: { id: string; onBack: () => void; onOpenInEditor?: (b: BookDocument) => void }) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [model, setModel] = useState<BookModel | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const modelRef = useRef<BookModel | null>(null);

  const load = useCallback(async () => {
    const d = await api.get(id);
    setDetail(d);
    setModel(d.model);
    modelRef.current = d.model;
    setDirty(false);
    setProcessing(!!d.job && ["queued", "processing"].includes(d.job.state));
    setRevision((r) => r + 1);
  }, [id]);
  useEffect(() => void load().catch((e) => setSaveError(e.message)), [load]);

  const save = useCallback(async () => {
    const m = modelRef.current;
    if (!m) return;
    setSaving("saving");
    try {
      const r = await api.saveModel(id, m);
      // Keep any edits made while the save was in flight.
      if (modelRef.current === m) {
        setModel(r.model);
        modelRef.current = r.model;
        setDirty(false);
      }
      setDetail((d) => (d ? { ...d, model: r.model, metrics: r.metrics } : d));
      setSaving("idle");
      setSaveError(null);
      setRevision((x) => x + 1);
    } catch (err) {
      setSaving("error");
      setSaveError((err as Error).message);
    }
  }, [id]);

  // Autosave 1.5 s after the last edit.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => void save(), 1500);
    return () => window.clearTimeout(t);
  }, [dirty, model, save]);

  const change = (m: BookModel) => {
    modelRef.current = m;
    setModel(m);
    setDirty(true);
  };

  if (!detail) return <div className="p-8 text-xs text-slate-500">{saveError ?? "Loading…"}</div>;
  if (processing || !model) return <JobPanel documentId={id} onFinished={load} />;

  const blocking = model.issues.filter((i) => !i.resolved && i.severity === "blocking").length;
  const open = model.issues.filter((i) => !i.resolved).length;
  const TABS: { id: Tab; label: string }[] = [
    { id: "review", label: `Review issues${open ? ` (${open})` : ""}` },
    { id: "preview", label: "Book preview" },
    { id: "export", label: "Export" },
    { id: "settings", label: "Book settings" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 bg-white px-4 pt-2">
        <div className="flex items-center gap-3">
          <button className="icon-button" aria-label="Back to list" onClick={onBack}>
            <Icon name="chevron" className="h-4 w-4 rotate-180" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">{model.settings.bookName || model.settings.chapterName || detail.files[0]?.originalName || "Untitled book"}</h2>
            <p className="truncate text-[11px] text-slate-500">
              {model.sourcePages.length} source pages · detected {model.detectedBookType.replace("_", " ")}
              {blocking ? <span className="text-rose-600"> · {blocking} blocking issue(s)</span> : null}
            </p>
          </div>
          <label className="ml-2 flex shrink-0 items-center gap-1.5 text-[11px] text-slate-600">
            Book type
            <select className="control-select !h-8" value={model.bookType} onChange={(e) => change({ ...model, bookType: e.target.value as BookType })} title={model.detection.reasons.join("\n")}>
              <option value="syllabus">Syllabus / study material</option>
              <option value="question_bank">Question bank</option>
            </select>
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px]">
            <span className={`whitespace-nowrap ${saving === "error" ? "text-rose-600" : "text-slate-500"}`} title={saveError ?? ""}>
              {saving === "saving" ? "Saving…" : saving === "error" ? "Save failed — retrying on next edit" : dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            {onOpenInEditor && (
              <button className="h-8 whitespace-nowrap rounded border border-slate-300 px-3 font-semibold hover:bg-slate-50" onClick={() => onOpenInEditor(modelToBookDocument(model))} title="Copy into the free-form editor">
                Open copy in editor
              </button>
            )}
            <button
              className="h-8 whitespace-nowrap rounded border border-slate-300 px-3 font-semibold hover:bg-slate-50"
              title="Run OCR again (cached pages are reused; your edits are backed up as a version)"
              onClick={async () => {
                if (!window.confirm("Rebuild the book from OCR? Your current edits are saved as a version first and can be restored.")) return;
                await api.saveVersion(id, "draft", "Before rebuild from OCR");
                await api.process(id, model.bookType === "question_bank" ? "question_bank" : "syllabus");
                setProcessing(true);
              }}
            >
              Rebuild from OCR
            </button>
          </div>
        </div>
        <nav className="mt-2 flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-xs font-semibold ${tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "review" && <ReviewPanel documentId={id} model={model} onChange={change} focusNodeId={focusNode} />}
        {tab === "preview" && (
          <PreviewPanel
            documentId={id}
            revision={revision}
            onOpenNode={(nodeId) => {
              setFocusNode(nodeId);
              setTab("review");
            }}
          />
        )}
        {tab === "export" && <ExportPanel documentId={id} detail={{ ...detail, model }} dirty={dirty} onSaveFirst={save} onRestored={(m) => { setModel(m); modelRef.current = m; setRevision((r) => r + 1); }} />}
        {tab === "settings" && (
          <div className="h-full overflow-auto">
            <div className="mx-auto max-w-3xl p-6">
              <SettingsForm
                value={model.settings}
                onChange={(settings) => change({ ...model, settings })}
                onLogo={async (file) => {
                  try {
                    const m = await api.uploadLogo(id, file);
                    setModel(m);
                    modelRef.current = m;
                    setRevision((r) => r + 1);
                  } catch (err) {
                    window.alert((err as Error).message);
                  }
                }}
              />
              <p className="mt-3 text-[11px] text-slate-500">Settings change only typesetting; OCR is not repeated.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookPipeline({ onOpenInEditor }: { onOpenInEditor?: (b: BookDocument) => void }) {
  const [view, setView] = useState<View>({ kind: "list" });
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-6">
        <div>
          <h1 className="text-base font-semibold text-slate-950">OCR → Book → Print</h1>
          <p className="text-[11px] text-slate-500">Structured reconstruction and print-ready PDF</p>
        </div>
      </header>
      <StatusBanner />
      <div className="min-h-0 flex-1 overflow-auto">
        {view.kind === "list" && <DocumentList onOpen={(id) => setView({ kind: "doc", id })} onNew={() => setView({ kind: "new" })} />}
        {view.kind === "new" && <NewDocumentFlow onStarted={(id) => setView({ kind: "doc", id })} onCancel={() => setView({ kind: "list" })} />}
        {view.kind === "doc" && <Workspace key={view.id} id={view.id} onBack={() => setView({ kind: "list" })} onOpenInEditor={onOpenInEditor} />}
      </div>
    </div>
  );
}
