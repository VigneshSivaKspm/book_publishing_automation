import { TRIM_PRESETS, type BookSettings, type TrimPreset } from "../../../shared/model.ts";

const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const label = "block text-[11px] font-semibold text-slate-600 mb-1";

export default function SettingsForm({
  value,
  onChange,
  onLogo,
  compact = false,
}: {
  value: BookSettings;
  onChange: (next: BookSettings) => void;
  onLogo?: (file: File) => void;
  compact?: boolean;
}) {
  const set = <K extends keyof BookSettings>(k: K, v: BookSettings[K]) => onChange({ ...value, [k]: v });
  const text = (k: keyof BookSettings, title: string, placeholder = "", hint?: string) => (
    <label className="block">
      <span className={label}>{title}</span>
      <input className={field} value={String(value[k] ?? "")} placeholder={placeholder} onChange={(e) => set(k, e.target.value as never)} />
      {hint && <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  );
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
      {text("bookName", "Book name", "e.g. Economics Study Material")}
      {text("subjectName", "Subject name", "e.g. Economics", "Running header on even pages")}
      {text("chapterNumber", "Chapter number", "Detected automatically if blank")}
      {text("chapterName", "Chapter name", "Detected automatically if blank", "Chapter opener and odd-page header")}
      {text("organisationName", "Organisation name", "e.g. Karthikeyan Analysis Study Circle", "Black header box")}
      {text("footerText", "Footer text", "Defaults to organisation name", "Question-bank footer")}
      <label className="block">
        <span className={label}>Page size</span>
        <select className={field} value={value.trim} onChange={(e) => set("trim", e.target.value as TrimPreset)}>
          {Object.entries(TRIM_PRESETS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
          <option value="CUSTOM">Custom size…</option>
        </select>
      </label>
      {value.trim === "CUSTOM" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>Width (mm)</span>
            <input type="number" min={90} max={500} className={field} value={value.customWidthMm} onChange={(e) => set("customWidthMm", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className={label}>Height (mm)</span>
            <input type="number" min={120} max={700} className={field} value={value.customHeightMm} onChange={(e) => set("customHeightMm", Number(e.target.value))} />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className={label}>Languages</span>
          <select className={field} value={value.languages.join(",")} onChange={(e) => set("languages", e.target.value.split(","))}>
            <option value="en">English</option>
            <option value="en,ta">English + Tamil</option>
            <option value="en,hi">English + Hindi</option>
            <option value="ta">Tamil</option>
          </select>
        </label>
      )}
      <div className={`${compact ? "" : "col-span-2"} grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3`}>
        <label className="check-row">
          <input type="checkbox" checked={value.watermarkEnabled} onChange={(e) => set("watermarkEnabled", e.target.checked)} />
          Watermark behind content
        </label>
        {value.watermarkEnabled && (
          <div className="grid grid-cols-2 gap-2">
            {text("watermarkText", "Watermark text", "Uses organisation name if blank")}
            <label className="block">
              <span className={label}>Opacity ({Math.round(value.watermarkOpacity * 100)}%)</span>
              <input type="range" min={0.02} max={0.3} step={0.01} value={value.watermarkOpacity} onChange={(e) => set("watermarkOpacity", Number(e.target.value))} className="w-full accent-indigo-600" />
            </label>
            {onLogo && (
              <label className="col-span-2 block">
                <span className={label}>Logo image (optional, replaces text seal)</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
              </label>
            )}
          </div>
        )}
        <label className="check-row">
          <input type="checkbox" checked={value.mirrored} onChange={(e) => set("mirrored", e.target.checked)} />
          Book layout: mirror headers & page numbers on odd/even pages
        </label>
        <label className="check-row">
          <input type="checkbox" checked={value.twoPass} onChange={(e) => set("twoPass", e.target.checked)} />
          Two-pass OCR (re-read formulas, tables and unclear text at high zoom)
        </label>
        <label className="check-row" title="Off = Source Fidelity Mode: text is never rewritten.">
          <input type="checkbox" checked={value.aiCorrectionMode} onChange={(e) => set("aiCorrectionMode", e.target.checked)} />
          AI grammar/spelling correction mode <span className="text-slate-400">(off = source fidelity)</span>
        </label>
      </div>
    </div>
  );
}
