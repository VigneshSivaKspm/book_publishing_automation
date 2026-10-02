import { useRef, useState } from "react";
import Icon from "../Icon";
import SettingsForm from "./SettingsForm";
import { api, ApiError } from "../../lib/api";
import { defaultSettings, type BookSettings, type BookTypeChoice } from "../../../shared/model.ts";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,application/pdf,image/*";
const TYPES: { id: BookTypeChoice; title: string; text: string }[] = [
  { id: "auto", title: "Auto detect", text: "Classify from questions, options, answer keys and prose. You can override afterwards." },
  { id: "syllabus", title: "Syllabus / study material", text: "Single column textbook: sections, bullets, tables, diagrams." },
  { id: "question_bank", title: "Question bank / MCQ", text: "Two columns, numbered questions, A–D options, years and answer key." },
];

function fmtBytes(n: number) {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function NewDocumentFlow({ onStarted, onCancel }: { onStarted: (documentId: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [bookType, setBookType] = useState<BookTypeChoice>("auto");
  const [settings, setSettings] = useState<BookSettings>(defaultSettings());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    setError(null);
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { documentId } = await api.create(settings);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        await api.upload(documentId, f, (fr) => setProgress(`Uploading ${f.name} (${i + 1}/${files.length}) — ${Math.round(fr * 100)}%`));
      }
      setProgress("Starting analysis…");
      await api.process(documentId, bookType);
      onStarted(documentId);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const move = (i: number, d: number) => {
    const next = [...files];
    const [f] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, f);
    setFiles(next);
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
        {["Upload", "Book type", "Book settings"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step > i + 1 ? "bg-emerald-600 text-white" : step === i + 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>
              {step > i + 1 ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={step === i + 1 ? "text-slate-900" : ""}>{s}</span>
            {i < 2 && <span className="mx-2 h-px w-10 bg-slate-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Upload source files</h2>
          <p className="mt-1 text-xs text-slate-500">PDF (scanned or digital), JPG, PNG, WEBP or Word .docx. Several files or page photos become one book, in the order shown.</p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => input.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-400"}`}
          >
            <Icon name="import" className="h-8 w-8 text-indigo-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Drop files here or click to browse</p>
            <p className="text-[11px] text-slate-500">Large books are processed page by page on the server — you can close this tab while it runs.</p>
            <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="w-5 text-right font-mono text-slate-400">{i + 1}</span>
                  <span className="flex-1 truncate font-medium text-slate-800">{f.name}</span>
                  {/\.doc$/i.test(f.name) && <span className="status-badge status-warning">Save as .docx first</span>}
                  <span className="text-slate-400">{fmtBytes(f.size)}</span>
                  <button className="icon-button" aria-label="Move up" onClick={() => move(i, -1)}>
                    <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                  <button className="icon-button" aria-label="Move down" onClick={() => move(i, 1)}>
                    <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
                  </button>
                  <button className="icon-button text-rose-600" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">What kind of book is this?</h2>
          <div className="mt-4 grid gap-3">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setBookType(t.id)} className={`creation-path text-left ${bookType === t.id ? "!border-indigo-500 ring-2 ring-indigo-100" : ""}`}>
                <span className="creation-icon">
                  <Icon name={t.id === "question_bank" ? "question" : t.id === "syllabus" ? "book" : "search"} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{t.title}</span>
                  <span className="block text-xs text-slate-500">{t.text}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Book settings</h2>
          <p className="mb-4 mt-1 text-xs text-slate-500">Everything here can be changed later without re-running OCR.</p>
          <SettingsForm value={settings} onChange={setSettings} />
        </section>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <button className="h-9 rounded-md px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={step === 1 ? onCancel : () => setStep(step - 1)} disabled={busy}>
          {step === 1 ? "Cancel" : "Back"}
        </button>
        <span className="ml-auto text-[11px] text-slate-500">{progress}</span>
        {step < 3 ? (
          <button
            className="h-9 rounded-md bg-indigo-600 px-5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
            disabled={step === 1 && (files.length === 0 || files.some((f) => /\.doc$/i.test(f.name)))}
            onClick={() => setStep(step + 1)}
          >
            Continue
          </button>
        ) : (
          <button className="h-9 rounded-md bg-indigo-600 px-5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40" disabled={busy} onClick={start}>
            {busy ? "Working…" : "Analyze document"}
          </button>
        )}
      </div>
    </div>
  );
}
