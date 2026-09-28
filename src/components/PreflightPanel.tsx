import Icon from "./Icon";
import type { PreflightIssue } from "../lib/preflight";
import { preflightSummary } from "../lib/preflight";

export default function PreflightPanel({ open, issues, onClose, onGoTo }: { open: boolean; issues: PreflightIssue[]; onClose: () => void; onGoTo: (issue: PreflightIssue) => void }) {
  if (!open) return null;
  const summary = preflightSummary(issues);
  return <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/30" role="dialog" aria-modal="true" aria-labelledby="preflight-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="h-full w-[440px] max-w-[92vw] bg-white border-l border-slate-200 shadow-2xl flex flex-col">
      <header className="h-14 px-4 flex items-center border-b border-slate-200">
        <div className="min-w-0"><h2 id="preflight-title" className="font-semibold text-slate-950">Review &amp; preflight</h2><p className="text-[11px] text-slate-500">Non-destructive checks for print readiness</p></div>
        <button className="ml-auto icon-button" onClick={onClose} aria-label="Close preflight"><Icon name="close" className="w-4 h-4" /></button>
      </header>
      <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
        <div className="p-3 border-r border-slate-200"><b className="text-rose-700">{summary.errors}</b><span className="block text-[10px] text-slate-500 uppercase tracking-wide">Errors</span></div>
        <div className="p-3 border-r border-slate-200"><b className="text-amber-700">{summary.warnings}</b><span className="block text-[10px] text-slate-500 uppercase tracking-wide">Warnings</span></div>
        <div className="p-3"><b className="text-slate-700">{summary.info}</b><span className="block text-[10px] text-slate-500 uppercase tracking-wide">Advisories</span></div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? <div className="p-8 text-center"><div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center"><Icon name="check" className="w-5 h-5" /></div><h3 className="font-semibold text-slate-900">Ready for export</h3><p className="mt-1 text-xs text-slate-500">No blocking issues were detected.</p></div> : issues.map((item) => <article key={item.id} className="p-4 border-b border-slate-100 hover:bg-slate-50">
          <div className="flex gap-3"><span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${item.severity === "error" ? "bg-rose-500" : item.severity === "warning" ? "bg-amber-500" : "bg-slate-400"}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="text-[13px] font-semibold text-slate-900">{item.title}</h3><span className="text-[10px] text-slate-500 whitespace-nowrap">Page {item.page}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p><p className="mt-1 text-[11px] text-slate-500">Suggested: {item.suggestion}</p><button onClick={() => onGoTo(item)} className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900">Go to issue →</button></div></div>
        </article>)}
      </div>
    </section>
  </div>;
}
