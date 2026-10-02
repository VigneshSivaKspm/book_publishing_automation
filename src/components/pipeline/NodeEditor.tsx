import MathText from "./MathText";
import type { ContentNode, ListItem, QuestionNode, QuestionOption, TableCell } from "../../../shared/model.ts";

const input = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const mono = `${input} font-mono`;
const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-500";

function Area({ value, onChange, rows = 3, label, math = true }: { value: string; onChange: (v: string) => void; rows?: number; label: string; math?: boolean }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <textarea className={mono} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {math && /\$/.test(value) && (
        <div className="mt-1 rounded bg-slate-50 px-2 py-1 text-[13px] text-slate-900">
          <MathText text={value} />
        </div>
      )}
    </label>
  );
}

function OptionsEditor({ options, onChange, title = "Options" }: { options: QuestionOption[]; onChange: (o: QuestionOption[]) => void; title?: string }) {
  return (
    <div className="space-y-1.5">
      <span className={lbl}>{title}</span>
      {options.map((o, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <input className={`${input} w-12 text-center`} value={o.label} aria-label="Option label" onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <div className="flex-1">
            <input className={mono} value={o.text} aria-label={`Option ${o.label}`} onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            {/\$/.test(o.text) && (
              <div className="px-1 text-[13px]">
                <MathText text={o.text} />
              </div>
            )}
          </div>
          <button className="icon-button text-rose-600" aria-label="Remove option" onClick={() => onChange(options.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button className="text-[11px] font-semibold text-indigo-600" onClick={() => onChange([...options, { label: String.fromCharCode(65 + options.length), text: "" }])}>
        + Add option
      </button>
    </div>
  );
}

function QuestionFields({ q, set }: { q: QuestionNode; set: (patch: Partial<QuestionNode>) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={lbl}>Number</span>
          <input className={input} value={q.number} onChange={(e) => set({ number: e.target.value })} />
        </label>
        <label className="block">
          <span className={lbl}>Year</span>
          <input className={input} value={q.year ?? ""} onChange={(e) => set({ year: e.target.value || null })} />
        </label>
        <label className="block">
          <span className={lbl}>Answer</span>
          <input className={input} value={q.answer ?? ""} onChange={(e) => set({ answer: e.target.value || null })} placeholder="from key" />
        </label>
      </div>
      <label className="block">
        <span className={lbl}>Type</span>
        <select className={input} value={q.questionKind} onChange={(e) => set({ questionKind: e.target.value as QuestionNode["questionKind"] })}>
          <option value="mcq">Multiple choice</option>
          <option value="assertion_reason">Assertion / Reason</option>
          <option value="match_following">Match the following</option>
          <option value="statement">Statement based</option>
          <option value="fill_blank">Fill in the blank</option>
          <option value="true_false">True / False</option>
          <option value="other">Other</option>
        </select>
      </label>
      <Area label="Question stem" value={q.stem} onChange={(v) => set({ stem: v })} />
      {(q.questionKind === "assertion_reason" || q.assertion) && (
        <>
          <Area label="Assertion (A)" rows={2} value={q.assertion ?? ""} onChange={(v) => set({ assertion: v || null })} />
          <Area label="Reason (R)" rows={2} value={q.reason ?? ""} onChange={(v) => set({ reason: v || null })} />
        </>
      )}
      {(q.questionKind === "statement" || q.statements.length > 0) && (
        <Area label="Statements (one per line)" rows={3} value={q.statements.join("\n")} onChange={(v) => set({ statements: v.split("\n").filter((s) => s.trim()) })} />
      )}
      {(q.questionKind === "match_following" || q.match) && (
        <div className="grid grid-cols-2 gap-2 rounded border border-slate-200 p-2">
          <OptionsEditor title={q.match?.left.title ?? "List I"} options={q.match?.left.items ?? []} onChange={(items) => set({ match: { left: { title: q.match?.left.title ?? "List I", items }, right: q.match?.right ?? { title: "List II", items: [] } } })} />
          <OptionsEditor title={q.match?.right.title ?? "List II"} options={q.match?.right.items ?? []} onChange={(items) => set({ match: { right: { title: q.match?.right.title ?? "List II", items }, left: q.match?.left ?? { title: "List I", items: [] } } })} />
        </div>
      )}
      <OptionsEditor options={q.options} onChange={(options) => set({ options })} />
    </div>
  );
}

function TableFields({ rows, set }: { rows: TableCell[][]; set: (rows: TableCell[][]) => void }) {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <div className="space-y-1">
      <span className={lbl}>Cells (first row toggles header)</span>
      <div className="overflow-auto">
        <table className="border-collapse text-xs">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }, (_, ci) => (
                  <td key={ci} className="border border-slate-200 p-0.5">
                    <input
                      className={`w-28 rounded px-1 py-0.5 font-mono text-[11px] ${r[ci]?.header ? "bg-slate-200 font-bold" : "bg-white"}`}
                      value={r[ci]?.text ?? ""}
                      onChange={(e) => {
                        const next = rows.map((row) => row.slice());
                        while (next[ri].length <= ci) next[ri].push({ text: "", header: false, colSpan: 1, rowSpan: 1 });
                        next[ri][ci] = { ...next[ri][ci], text: e.target.value };
                        set(next);
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button className="px-1 text-rose-600" aria-label="Delete row" onClick={() => set(rows.filter((_, j) => j !== ri))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 text-[11px] font-semibold text-indigo-600">
        <button onClick={() => set([...rows, Array.from({ length: cols }, () => ({ text: "", header: false, colSpan: 1, rowSpan: 1 }))])}>+ Row</button>
        <button onClick={() => set(rows.map((r, i) => [...r, { text: "", header: i === 0 && r[0]?.header, colSpan: 1, rowSpan: 1 }]))}>+ Column</button>
        <button onClick={() => set(rows.map((r, i) => (i === 0 ? r.map((c) => ({ ...c, header: !c.header })) : r)))}>Toggle header row</button>
      </div>
    </div>
  );
}

function ListFields({ items, set }: { items: ListItem[]; set: (items: ListItem[]) => void }) {
  return (
    <div className="space-y-1.5">
      <span className={lbl}>Items</span>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <input className={`${input} w-12 text-center`} value={it.marker} aria-label="Marker" onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, marker: e.target.value } : x)))} />
          <select className={`${input} w-14`} value={it.level} aria-label="Level" onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)))}>
            {[1, 2, 3, 4].map((l) => (
              <option key={l} value={l}>
                L{l}
              </option>
            ))}
          </select>
          <textarea className={`${mono} flex-1`} rows={Math.min(4, Math.ceil(it.text.length / 60) || 1)} value={it.text} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button className="icon-button text-rose-600" aria-label="Remove item" onClick={() => set(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button className="text-[11px] font-semibold text-indigo-600" onClick={() => set([...items, { marker: items.at(-1)?.marker ?? "•", text: "", level: 1 }])}>
        + Add item
      </button>
    </div>
  );
}

/** Edits one content node. Every edit marks the node as verified by a person. */
export default function NodeEditor({ node, onChange, assetUrl }: { node: ContentNode; onChange: (n: ContentNode) => void; assetUrl: (id: string) => string }) {
  const set = (patch: Partial<ContentNode>) => onChange({ ...node, ...patch, verified: true } as ContentNode);
  switch (node.kind) {
    case "heading":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className={lbl}>Level</span>
              <select className={input} value={node.level} onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
                <option value={1}>Section (2.1)</option>
                <option value={2}>Sub-section (2.6.1)</option>
                <option value={3}>Sub-sub-section</option>
                <option value={4}>Run-in bold heading</option>
              </select>
            </label>
            <label className="col-span-2 block">
              <span className={lbl}>Number</span>
              <input className={input} value={node.number ?? ""} onChange={(e) => set({ number: e.target.value || null })} />
            </label>
          </div>
          <Area label="Heading text" rows={2} value={node.text} onChange={(v) => set({ text: v })} />
        </div>
      );
    case "paragraph":
      return (
        <div className="space-y-2.5">
          <label className="block">
            <span className={lbl}>Role</span>
            <select className={input} value={node.role} onChange={(e) => set({ role: e.target.value as typeof node.role })}>
              <option value="body">Body text</option>
              <option value="definition">Definition</option>
              <option value="quote">Quote</option>
              <option value="note">Note</option>
            </select>
          </label>
          <Area label="Text" rows={6} value={node.text} onChange={(v) => set({ text: v })} />
        </div>
      );
    case "list":
      return <ListFields items={node.items} set={(items) => set({ items })} />;
    case "equation":
      return (
        <div className="space-y-2">
          <label className="block">
            <span className={lbl}>LaTeX</span>
            <textarea className={mono} rows={3} value={node.latex} onChange={(e) => set({ latex: e.target.value })} spellCheck={false} />
          </label>
          <div className="rounded bg-slate-50 p-2 text-center">
            <MathText text={node.latex} display />
          </div>
        </div>
      );
    case "table":
      return (
        <div className="space-y-2">
          <label className="block">
            <span className={lbl}>Caption</span>
            <input className={input} value={node.caption ?? ""} onChange={(e) => set({ caption: e.target.value || null })} />
          </label>
          <TableFields rows={node.rows} set={(rows) => set({ rows })} />
        </div>
      );
    case "figure":
      return (
        <div className="space-y-2">
          {node.assetId ? <img src={assetUrl(node.assetId)} alt={node.caption ?? "Figure"} className="max-h-56 rounded border border-slate-200 bg-white" /> : <p className="text-xs text-rose-600">No image — draw a crop on the source page.</p>}
          <label className="block">
            <span className={lbl}>Label</span>
            <input className={input} value={node.label ?? ""} onChange={(e) => set({ label: e.target.value || null })} />
          </label>
          <label className="block">
            <span className={lbl}>Caption</span>
            <input className={input} value={node.caption ?? ""} onChange={(e) => set({ caption: e.target.value || null })} />
          </label>
        </div>
      );
    case "question":
      return <QuestionFields q={node} set={(p) => set(p)} />;
  }
}
