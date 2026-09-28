import type { BookDocument, ContentBlock, PaperSize } from "../types";
import { PAPER_LABELS } from "../types";

const blockLabels: Partial<Record<ContentBlock["type"], string>> = { "chapter-title": "Chapter title", heading1: "Heading 1", heading2: "Heading 2", heading3: "Heading 3", paragraph: "Paragraph", list: "List", definition: "Definition", theorem: "Theorem", example: "Example", solution: "Solution", note: "Note", exercise: "Exercise", mcq: "Multiple-choice question", math: "Formula", table: "Table", image: "Image", spacer: "Spacer", "page-break": "Page break" };

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="block mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }

export default function ContextInspector({ book, selected, onUpdateBlock, onUpdateBook, onOpenHeaderFooter, onMove, onDelete }: {
  book: BookDocument;
  selected?: ContentBlock;
  onUpdateBlock: (patch: Partial<ContentBlock>) => void;
  onUpdateBook: (book: BookDocument, label?: string) => void;
  onOpenHeaderFooter: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const input = "w-full h-9 px-2.5 border border-slate-300 rounded-md bg-white text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  return <aside className="editor-inspector" aria-label="Context inspector">
    <div className="h-10 px-3 flex items-center border-b border-slate-200 bg-white"><span className="text-xs font-semibold text-slate-900">{selected ? "Block inspector" : "Document settings"}</span></div>
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {selected ? <>
        <section className="inspector-section"><h3>Content</h3><div className="space-y-3"><Field label="Block type"><select className={input} value={selected.type} onChange={(event) => onUpdateBlock({ type: event.target.value as ContentBlock["type"] })}>{Object.entries(blockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          {selected.type === "mcq" && <><Field label="Correct answer"><select className={input} value={selected.answer || ""} onChange={(event) => onUpdateBlock({ answer: event.target.value })}><option value="">Unresolved</option>{["A", "B", "C", "D", "E"].map((letter) => <option key={letter}>{letter}</option>)}</select></Field><Field label="Explanation"><textarea className={`${input} h-20 py-2 resize-y`} value={selected.explanation || ""} onChange={(event) => onUpdateBlock({ explanation: event.target.value })} /></Field></>}
          {selected.type === "image" && <Field label="Alternative text"><textarea className={`${input} h-20 py-2 resize-y`} value={selected.imageAlt || ""} onChange={(event) => onUpdateBlock({ imageAlt: event.target.value })} /></Field>}
        </div></section>
        <section className="inspector-section"><h3>Typography</h3><div className="grid grid-cols-2 gap-2"><Field label="Size (pt)"><input className={input} type="number" min="6" max="72" value={selected.fontSize || 11} onChange={(event) => onUpdateBlock({ fontSize: Number(event.target.value) })} /></Field><Field label="Alignment"><select className={input} value={selected.align || "left"} onChange={(event) => onUpdateBlock({ align: event.target.value as ContentBlock["align"] })}><option>left</option><option>center</option><option>right</option><option>justify</option></select></Field></div></section>
        <section className="inspector-section"><h3>Layout</h3><label className="check-row"><input type="checkbox" checked={selected.keepWithNext || false} onChange={(event) => onUpdateBlock({ keepWithNext: event.target.checked })} />Keep with next</label><label className="check-row"><input type="checkbox" checked={selected.avoidBreakInside ?? selected.type === "mcq"} onChange={(event) => onUpdateBlock({ avoidBreakInside: event.target.checked })} />Avoid page break inside</label><div className="grid grid-cols-2 gap-2 mt-3"><button className="secondary-button" onClick={() => onMove("up")}>Move up</button><button className="secondary-button" onClick={() => onMove("down")}>Move down</button></div><button className="danger-button w-full mt-2" onClick={onDelete}>Delete block</button></section>
        {(selected.sourcePage || selected.confidence != null || selected.warnings?.length) && <section className="inspector-section"><h3>Source &amp; OCR</h3><dl className="text-xs space-y-2"><div className="flex justify-between"><dt className="text-slate-500">Source page</dt><dd>{selected.sourcePage || "—"}</dd></div>{selected.confidence != null && <div className="flex justify-between"><dt className="text-slate-500">Confidence</dt><dd>{Math.round(selected.confidence * 100)}%</dd></div>}</dl>{selected.warnings?.map((warning) => <p key={warning} className="mt-2 text-[11px] text-amber-700">{warning}</p>)}</section>}
      </> : <>
        <section className="inspector-section"><h3>Page &amp; layout</h3><div className="space-y-3"><Field label="Paper size"><select className={input} value={book.paperSize} onChange={(event) => onUpdateBook({ ...book, paperSize: event.target.value as PaperSize }, "Paper size updated")}>{(Object.keys(PAPER_LABELS) as PaperSize[]).filter((value) => value !== "CUSTOM").map((value) => <option key={value} value={value}>{PAPER_LABELS[value]}</option>)}</select></Field><Field label="Columns"><div className="segmented"><button className={book.headerFooter.layoutColumns === 1 ? "active" : ""} onClick={() => onUpdateBook({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 1 } }, "One-column layout")}>1 column</button><button className={book.headerFooter.layoutColumns === 2 ? "active" : ""} onClick={() => onUpdateBook({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 2 } }, "Two-column layout")}>2 columns</button></div></Field><label className="check-row"><input type="checkbox" checked={book.headerFooter.showColumnDivider} onChange={(event) => onUpdateBook({ ...book, headerFooter: { ...book.headerFooter, showColumnDivider: event.target.checked } }, "Column divider updated")} />Column divider</label><label className="check-row"><input type="checkbox" checked={book.headerFooter.mirroredMargins || false} onChange={(event) => onUpdateBook({ ...book, headerFooter: { ...book.headerFooter, mirroredMargins: event.target.checked } }, "Mirrored margins updated")} />Mirrored margins</label></div></section>
        <section className="inspector-section"><h3>Publication furniture</h3><button className="secondary-button w-full" onClick={onOpenHeaderFooter}>Headers, footers &amp; watermark</button><p className="mt-2 text-[11px] leading-4 text-slate-500">Controls alternating running headers, first-page chapter badge, page numbers and watermark.</p></section>
        <section className="inspector-section"><h3>Local publishing</h3><p className="text-[11px] leading-5 text-slate-600">Projects autosave to this browser using IndexedDB. Use project backup before moving devices or clearing browser data.</p></section>
      </>}
    </div>
  </aside>;
}
