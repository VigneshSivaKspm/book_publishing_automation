import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../Icon";
import MathText from "./MathText";
import NodeEditor from "./NodeEditor";
import { api } from "../../lib/api";
import { confidenceBand, nodePlainText, type BBox, type BookModel, type ContentNode, type IssueCategory, type ReviewIssue } from "../../../shared/model.ts";

type Filter = "all" | "low" | "equation" | "table" | "question" | "missing";
const FILTERS: { id: Filter; label: string; match: (i: ReviewIssue) => boolean }[] = [
  { id: "all", label: "All issues", match: () => true },
  { id: "low", label: "Low confidence", match: (i) => i.category === "low_confidence" },
  { id: "equation", label: "Equations", match: (i) => i.category === "equation" },
  { id: "table", label: "Tables", match: (i) => i.category === "table" },
  { id: "question", label: "Questions", match: (i) => i.category === "question" },
  { id: "missing", label: "Missing content", match: (i) => (["missing_content", "page", "figure"] as IssueCategory[]).includes(i.category) },
];

const KIND_LABEL: Record<ContentNode["kind"], string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "List",
  equation: "Equation",
  table: "Table",
  figure: "Figure",
  question: "Question",
};

function locate(model: BookModel, id: string): { c: number; n: number } | null {
  for (let c = 0; c < model.chapters.length; c++) {
    const n = model.chapters[c].nodes.findIndex((x) => x.id === id);
    if (n >= 0) return { c, n };
  }
  return null;
}

export default function ReviewPanel({
  documentId,
  model,
  onChange,
  focusNodeId,
}: {
  documentId: string;
  model: BookModel;
  onChange: (m: BookModel) => void;
  focusNodeId: string | null;
}) {
  const pages = model.sourcePages.map((p) => p.index);
  const [page, setPage] = useState(pages[0] ?? 1);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const imgBox = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => model.chapters.flatMap((c) => c.nodes), [model]);
  const pageNodes = nodes.filter((n) => n.sourcePage === page);
  const sel = nodes.find((n) => n.id === selected) ?? null;
  const issues = model.issues.filter((i) => (showResolved || !i.resolved) && FILTERS.find((f) => f.id === filter)!.match(i));
  const issueIdx = issues.findIndex((i) => i.nodeId === selected);
  const srcInfo = model.sourcePages.find((p) => p.index === page);

  useEffect(() => {
    if (!focusNodeId) return;
    const n = nodes.find((x) => x.id === focusNodeId);
    if (n) {
      setPage(n.sourcePage);
      setSelected(n.id);
    }
  }, [focusNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const goIssue = (d: number) => {
    if (!issues.length) return;
    const next = issues[(issueIdx + d + issues.length) % issues.length];
    if (next.sourcePage) setPage(next.sourcePage);
    setSelected(next.nodeId);
  };

  const updateNode = (n: ContentNode) => {
    const loc = locate(model, n.id);
    if (!loc) return;
    const chapters = model.chapters.map((c, ci) => (ci === loc.c ? { ...c, nodes: c.nodes.map((x, ni) => (ni === loc.n ? n : x)) } : c));
    onChange({ ...model, chapters });
  };

  const removeNode = (id: string) => {
    if (!window.confirm("Remove this block from the book? (A saved version can restore it.)")) return;
    onChange({ ...model, chapters: model.chapters.map((c) => ({ ...c, nodes: c.nodes.filter((x) => x.id !== id) })) });
    setSelected(null);
  };

  const moveNode = (id: string, d: number) => {
    const loc = locate(model, id);
    if (!loc) return;
    const list = [...model.chapters[loc.c].nodes];
    const to = loc.n + d;
    if (to < 0 || to >= list.length) return;
    [list[loc.n], list[to]] = [list[to], list[loc.n]];
    onChange({ ...model, chapters: model.chapters.map((c, ci) => (ci === loc.c ? { ...c, nodes: list } : c)) });
  };

  /** Mark the block verified and resolve its issues in one update. */
  const approve = (n: ContentNode) => {
    const chapters = model.chapters.map((c) => ({ ...c, nodes: c.nodes.map((x) => (x.id === n.id ? ({ ...x, verified: true } as ContentNode) : x)) }));
    onChange({ ...model, chapters, issues: model.issues.map((i) => (i.nodeId === n.id ? { ...i, resolved: true } : i)) });
  };
  const toggleIssue = (id: string) => onChange({ ...model, issues: model.issues.map((i) => (i.id === id ? { ...i, resolved: !i.resolved } : i)) });
  const pageIssues = model.issues.filter((i) => i.nodeId === null && (i.sourcePage === page || i.sourcePage === null));

  const point = (e: React.MouseEvent) => {
    const r = imgBox.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const finishCrop = async () => {
    if (!drag || !sel) return;
    const bbox: BBox = { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };
    setDrag(null);
    setCropMode(false);
    if (bbox.w < 0.02 || bbox.h < 0.02) return;
    setBusy("Saving crop…");
    try {
      const r = await api.recropFigure(documentId, sel.id, page, bbox);
      onChange(r.model);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const box = (b: BBox | null, cls: string, key: string, onClick?: () => void) =>
    b && (
      <button
        key={key}
        onClick={onClick}
        aria-label="Select block"
        className={`absolute ${cls}`}
        style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
      />
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <select className="control-select" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Issue filter">
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} ({model.issues.filter((i) => !i.resolved && f.match(i)).length})
            </option>
          ))}
        </select>
        <button className="h-8 rounded border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50" onClick={() => goIssue(-1)} disabled={!issues.length}>
          ← Previous issue
        </button>
        <button className="h-8 rounded border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50" onClick={() => goIssue(1)} disabled={!issues.length}>
          Next issue →
        </button>
        <span className="text-[11px] text-slate-500">{issues.length ? `${issueIdx >= 0 ? issueIdx + 1 : "–"} / ${issues.length}` : "No open issues in this filter"}</span>
        <label className="check-row ml-2 !min-h-0 text-[11px]">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> show resolved
        </label>
        <div className="ml-auto flex items-center gap-1 text-xs">
          <button className="icon-button" aria-label="Previous page" onClick={() => setPage(Math.max(pages[0], page - 1))}>
            <Icon name="chevron" className="h-4 w-4 rotate-180" />
          </button>
          <select className="control-select !h-8" value={page} onChange={(e) => setPage(Number(e.target.value))} aria-label="Source page">
            {model.sourcePages.map((p) => (
              <option key={p.index} value={p.index}>
                Page {p.index}
                {p.status === "failed" ? " — failed" : ""}
              </option>
            ))}
          </select>
          <button className="icon-button" aria-label="Next page" onClick={() => setPage(Math.min(pages.at(-1) ?? 1, page + 1))}>
            <Icon name="chevron" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.05fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
        {/* Source page */}
        <div className="min-h-0 overflow-auto bg-slate-200 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-600">
            <span className="font-semibold">Source page {page}</span>
            {srcInfo && <span className="status-badge bg-white text-slate-600">{srcInfo.method}</span>}
            {srcInfo?.ocrConfidence != null && <span className="status-badge bg-white text-slate-600">confidence {Math.round(srcInfo.ocrConfidence * 100)}%</span>}
            {(srcInfo?.method === "scanned" || srcInfo?.method === "image") && (
              <label className="check-row !min-h-0 ml-auto text-[11px]">
                <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} /> original scan
              </label>
            )}
          </div>
          {srcInfo?.error && <div className="mb-2 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{srcInfo.error}</div>}
          <div
            ref={imgBox}
            className={`relative mx-auto max-w-[680px] bg-white shadow ${cropMode ? "cursor-crosshair" : ""}`}
            onMouseDown={(e) => {
              if (!cropMode) return;
              const p = point(e);
              setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            }}
            onMouseMove={(e) => {
              if (!cropMode || !drag) return;
              const p = point(e);
              setDrag({ ...drag, x1: p.x, y1: p.y });
            }}
            onMouseUp={finishCrop}
          >
            <img src={api.pageImage(documentId, page, showOriginal ? "original" : "image")} alt={`Source page ${page}`} className="block w-full select-none" draggable={false} />
            {!cropMode &&
              pageNodes.map((n) =>
                box(
                  n.bbox,
                  n.id === selected ? "border-2 border-indigo-600 bg-indigo-500/10" : n.needsReview ? "border border-rose-500/70 bg-rose-500/5 hover:bg-rose-500/10" : "border border-emerald-500/40 hover:bg-emerald-500/10",
                  n.id,
                  () => setSelected(n.id),
                ),
              )}
            {drag && box({ x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) }, "border-2 border-dashed border-indigo-600 bg-indigo-500/10 pointer-events-none", "drag")}
          </div>
        </div>

        {/* Blocks on this page */}
        <div className="min-h-0 overflow-auto border-x border-slate-200 bg-slate-50">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
            {pageNodes.length} block(s) from page {page}
          </div>
          {pageIssues.length > 0 && (
            <ul className="space-y-1 border-b border-slate-200 p-2">
              {pageIssues.map((i) => (
                <li key={i.id} className={`flex items-start gap-2 rounded px-2 py-1.5 text-[11px] ${i.resolved ? "bg-slate-100 text-slate-400 line-through" : i.severity === "blocking" ? "bg-rose-50 text-rose-800" : i.severity === "warning" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"}`}>
                  <span className="flex-1">{i.message}</span>
                  <button className="shrink-0 font-semibold underline" onClick={() => toggleIssue(i.id)}>
                    {i.resolved ? "Reopen" : "Resolve"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul>
            {pageNodes.map((n) => {
              const band = confidenceBand(n.confidence);
              return (
                <li key={n.id}>
                  <button onClick={() => setSelected(n.id)} className={`block w-full border-b border-slate-200 px-3 py-2 text-left ${n.id === selected ? "bg-indigo-50" : "hover:bg-white"}`}>
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {KIND_LABEL[n.kind]}
                        {n.kind === "question" ? ` ${n.number}` : n.kind === "heading" && n.number ? ` ${n.number}` : ""}
                      </span>
                      <span className={`status-badge !min-h-4 !px-1.5 !text-[9px] ${band === "high" ? "status-good" : band === "medium" ? "status-warning" : "status-error"}`}>{Math.round(n.confidence * 100)}%</span>
                      {n.needsReview && <Icon name="warning" className="h-3.5 w-3.5 text-rose-600" />}
                      {n.verified && <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />}
                    </div>
                    <div className="line-clamp-3 text-[12px] leading-snug text-slate-800">
                      <MathText text={nodePlainText(n).slice(0, 260)} />
                    </div>
                  </button>
                </li>
              );
            })}
            {pageNodes.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">No content was extracted from this page.</li>}
          </ul>
        </div>

        {/* Editor */}
        <div className="min-h-0 overflow-auto bg-white p-4">
          {busy && <div className="mb-2 text-xs text-indigo-600">{busy}</div>}
          {sel ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{KIND_LABEL[sel.kind]}</h3>
                <span className="text-[11px] text-slate-500">source page {sel.sourcePage}</span>
                <div className="ml-auto flex gap-1">
                  <button className="icon-button" aria-label="Move block up" onClick={() => moveNode(sel.id, -1)}>
                    <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                  <button className="icon-button" aria-label="Move block down" onClick={() => moveNode(sel.id, 1)}>
                    <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
                  </button>
                  <button className="icon-button text-rose-600" aria-label="Remove block" onClick={() => removeNode(sel.id)}>
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {sel.reviewReasons.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  <ul className="list-disc pl-4">
                    {sel.reviewReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <NodeEditor node={sel} onChange={updateNode} assetUrl={(id) => api.assetUrl(documentId, id)} />
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  className="h-8 rounded bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                  onClick={() => approve(sel)}
                >
                  Approve block (matches source)
                </button>
                {(sel.kind === "figure" || sel.kind === "question") && (
                  <button className={`h-8 rounded border px-3 text-xs font-semibold ${cropMode ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"}`} onClick={() => setCropMode(!cropMode)}>
                    {cropMode ? "Drag on the page to crop…" : sel.kind === "figure" ? "Re-crop figure from page" : "Attach figure from page"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-500">
              <Icon name="review" className="mb-2 h-8 w-8 text-slate-300" />
              Select a block on the source page or in the list to proof it.
              <br />
              Red outlines need review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
