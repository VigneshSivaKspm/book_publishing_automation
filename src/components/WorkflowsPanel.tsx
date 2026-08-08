import { useState } from 'react'

interface WorkflowItem {
  id: string
  name: string
  description: string
  stagesCount: number
  trigger: string
  lastRun: string
  status: 'ACTIVE' | 'PAUSED'
}

const INITIAL_WORKFLOWS: WorkflowItem[] = [
  {
    id: 'wf_1',
    name: 'Standard Question Bank Automated Pipeline',
    description: 'Automated 4-stage pipeline: AI OCR import → TeX formula parsing → Question bank alignment → Multi-size PDF rendering.',
    stagesCount: 4,
    trigger: 'On Document Upload / Batch Import',
    lastRun: '10 mins ago',
    status: 'ACTIVE',
  },
  {
    id: 'wf_2',
    name: 'Scanned Exam Paper Digitization',
    description: 'Converts scanned paper images into editable question blocks with math formula extraction and answer key indexing.',
    stagesCount: 3,
    trigger: 'Manual Trigger / Scan Action',
    lastRun: '1 hour ago',
    status: 'ACTIVE',
  },
  {
    id: 'wf_3',
    name: 'Multi-Format Press-Ready PDF Export',
    description: 'Generates press-ready output files formatted for A4, B5, and 8x8 publication trim sizes with dynamic headers & watermarks.',
    stagesCount: 5,
    trigger: 'On Export Action',
    lastRun: 'Yesterday',
    status: 'ACTIVE',
  },
]

export default function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(INITIAL_WORKFLOWS)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const nextStatus = w.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
          showToast(`Workflow "${w.name}" status changed to ${nextStatus}.`)
          return { ...w, status: nextStatus }
        }
        return w
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
            <span>DOCUMENT PROCESSING</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">WORKFLOW PIPELINES</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Document Automation Pipelines & Workflows
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Orchestrate content entry, AI OCR extraction, question alignment, compilation, and press export.
          </p>
        </div>

        <div>
          <button
            onClick={() => showToast('New workflow creation drawer opened.')}
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            CREATE NEW WORKFLOW
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {workflows.map((wf) => (
          <div key={wf.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 max-w-[720px]">
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="text-[16px] font-bold text-slate-900">{wf.name}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    wf.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-50 text-amber-900 border border-amber-300'
                  }`}
                >
                  {wf.status}
                </span>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{wf.description}</p>

              <div className="flex flex-wrap items-center gap-4 text-[12px] text-slate-500 font-medium">
                <span>STAGES: <strong className="text-slate-800">{wf.stagesCount} Stages</strong></span>
                <span>TRIGGER: <strong className="text-slate-800">{wf.trigger}</strong></span>
                <span>LAST RUN: <strong className="text-slate-800">{wf.lastRun}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center">
              <button
                onClick={() => showToast(`Executing workflow pipeline "${wf.name}"...`)}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                RUN WORKFLOW
              </button>
              <button
                onClick={() => toggleWorkflow(wf.id)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12px] font-bold uppercase tracking-wider transition-colors border border-slate-300"
              >
                {wf.status === 'ACTIVE' ? 'PAUSE WORKFLOW' : 'ENABLE WORKFLOW'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
