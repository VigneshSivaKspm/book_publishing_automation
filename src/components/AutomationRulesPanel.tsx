import { useState } from 'react'

interface AutomationRule {
  id: string
  title: string
  triggerCondition: string
  actionEffect: string
  status: 'ENABLED' | 'DISABLED'
}

const INITIAL_RULES: AutomationRule[] = [
  {
    id: 'rule_1',
    title: 'Auto-Format Incoming Scanned Formulas to TeX Math Blocks',
    triggerCondition: 'WHEN scanned text matches LaTeX syntax regex ($...$ or $$...$$)',
    actionEffect: 'THEN convert string into rendered Katex formula block and apply STIX Two Math typography',
    status: 'ENABLED',
  },
  {
    id: 'rule_2',
    title: 'Automatic Question Renumbering & Choice Alignment',
    triggerCondition: 'WHEN new MCQ block is inserted or removed',
    actionEffect: 'THEN re-index question sequence numbers (1, 2, 3...) and align option columns (2-column format)',
    status: 'ENABLED',
  },
  {
    id: 'rule_3',
    title: 'Auto Generate MCQ Answer Key Footnotes',
    triggerCondition: 'WHEN document mode is set to Question Bank',
    actionEffect: 'THEN aggregate answers (1-A, 2-C, 3-B) and print Answer Key table at end of chapter',
    status: 'ENABLED',
  },
  {
    id: 'rule_4',
    title: 'Watermark Seal Auto-Apply on PDF Export',
    triggerCondition: 'WHEN PDF Export for press print is initiated',
    actionEffect: 'THEN render background opacity watermark "KARTHIKEYAN ANALYSIS STUDY CIRCLE" across center canvas',
    status: 'ENABLED',
  },
]

export default function AutomationRulesPanel() {
  const [rules, setRules] = useState<AutomationRule[]>(INITIAL_RULES)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextStatus = r.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
          showToast(`Automation Rule "${r.title}" is now ${nextStatus}.`)
          return { ...r, status: nextStatus }
        }
        return r
      })
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-lg bg-slate-900 text-white text-[13px] font-medium shadow-xl border border-slate-700 animate-slide-up">
          {toast}
        </div>
      )}

      <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 tracking-wider uppercase mb-1">
            <span>SYSTEM AUTOMATION</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">AUTOMATION RULES</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Document Automation & Formatting Engine Rules
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Configure automated rules for formula parsing, MCQ renumbering, layout alignment, and watermark insertion.
          </p>
        </div>

        <div>
          <button
            onClick={() => showToast('New automation rule modal opened.')}
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            CREATE AUTOMATION RULE
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="flex-1 max-w-[800px]">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-[15px] font-bold text-slate-900">{rule.title}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    rule.status === 'ENABLED'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300'
                  }`}
                >
                  {rule.status}
                </span>
              </div>

              <div className="space-y-1.5 text-[12px]">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 font-mono text-slate-700">
                  <span className="font-bold text-slate-900">TRIGGER: </span> {rule.triggerCondition}
                </div>
                <div className="p-2.5 bg-slate-100 rounded border border-slate-200 font-mono text-slate-800">
                  <span className="font-bold text-slate-900">ACTION: </span> {rule.actionEffect}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleRule(rule.id)}
                className={`px-3.5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors border ${
                  rule.status === 'ENABLED'
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                {rule.status === 'ENABLED' ? 'DISABLE RULE' : 'ENABLE RULE'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
