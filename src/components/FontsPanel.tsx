import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { BookDocument } from "../types";
import {
  FONT_PRESETS,
  ensureFontLoaded,
  exportFontFile,
  exportFontPack,
  hydrateCustomFonts,
  importFontFile,
  importFontPack,
  listCustomFonts,
  onFontsChanged,
  removeCustomFont,
  resolveBodyStack,
  type CustomFontRecord,
} from "../lib/fonts";

type FontPatch = Pick<
  BookDocument,
  "fontId" | "mathFontId" | "customFontFamily" | "customFontLabel"
>;

interface FontsPanelProps {
  book: BookDocument;
  onApply: (patch: Partial<FontPatch>, msg: string) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const CUSTOM = "custom:";
const BODY_GROUPS = ["English", "Tamil", "Mixed"] as const;

/** Upload / choose the text and math fonts for a book (question bank and syllabus alike). */
export default function FontsPanel({
  book,
  onApply,
  onClose,
  onNotify,
}: FontsPanelProps) {
  const [fonts, setFonts] = useState<CustomFontRecord[]>(listCustomFonts());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const packRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const off = onFontsChanged(() => setFonts([...listCustomFonts()]));
    hydrateCustomFonts().then(() => setFonts([...listCustomFonts()]));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bodyIsCustom = book.fontId === "custom" && !!book.customFontFamily;
  const bodyValue = bodyIsCustom
    ? CUSTOM + book.customFontFamily
    : book.fontId || "english-serif";
  const mathIsCustom = fonts.some((f) => f.id === book.mathFontId);
  const mathValue = mathIsCustom
    ? CUSTOM + book.mathFontId
    : book.mathFontId || "math-stix";

  const missingBody =
    bodyIsCustom && !fonts.some((f) => f.family === book.customFontFamily);
  const missingMath =
    !!book.mathFontId?.startsWith("Custom_") && !mathIsCustom;

  const bodyStack = resolveBodyStack(book.fontId, book.customFontFamily);
  const mathStack = resolveBodyStack(
    book.mathFontId || "math-stix",
    mathIsCustom ? book.mathFontId : undefined,
  );

  const useAsBody = (f: CustomFontRecord) =>
    onApply(
      { fontId: "custom", customFontFamily: f.family, customFontLabel: f.name },
      `Text font → ${f.name}`,
    );
  const useAsMath = (f: CustomFontRecord) =>
    onApply({ mathFontId: f.id }, `Math font → ${f.name}`);

  const pickBody = (value: string) => {
    if (value.startsWith(CUSTOM)) {
      const f = fonts.find((x) => x.family === value.slice(CUSTOM.length));
      if (f) useAsBody(f);
      return;
    }
    const p = FONT_PRESETS.find((x) => x.id === value);
    if (!p) return;
    ensureFontLoaded(p.id);
    onApply(
      { fontId: p.id, customFontFamily: undefined, customFontLabel: undefined },
      `Text font → ${p.label}`,
    );
  };

  const pickMath = (value: string) => {
    if (value.startsWith(CUSTOM)) {
      const f = fonts.find((x) => x.id === value.slice(CUSTOM.length));
      if (f) useAsMath(f);
      return;
    }
    const p = FONT_PRESETS.find((x) => x.id === value);
    if (!p) return;
    ensureFontLoaded(p.id);
    onApply({ mathFontId: p.id }, `Math font → ${p.label}`);
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let last: CustomFontRecord | null = null;
    const failed: string[] = [];
    for (const file of files) {
      try {
        last = await importFontFile(file);
      } catch (err) {
        failed.push(err instanceof Error ? err.message : file.name);
      }
    }
    setBusy(false);
    if (last) useAsBody(last);
    if (failed.length) onNotify(failed[0]);
    else if (last)
      onNotify(
        files.length > 1
          ? `${files.length} fonts added · text now uses ${last.name}`
          : `“${last.name}” added and applied to the text`,
      );
  };

  const onPackImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { count, prefs } = await importFontPack(file);
      if (prefs?.fontId || prefs?.mathFontId) {
        onApply(
          {
            fontId: prefs.fontId || book.fontId,
            mathFontId: prefs.mathFontId || book.mathFontId,
            customFontFamily: prefs.customFontFamily,
            customFontLabel: prefs.customFontLabel,
          },
          `Imported ${count} font${count === 1 ? "" : "s"} and their settings`,
        );
      } else {
        onNotify(`Imported ${count} font${count === 1 ? "" : "s"}`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Could not import font pack");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (f: CustomFontRecord) => {
    if (!window.confirm(`Remove “${f.name}” from your fonts?`)) return;
    const patch: Partial<FontPatch> = {};
    if (book.fontId === "custom" && book.customFontFamily === f.family) {
      patch.fontId = "english-serif";
      patch.customFontFamily = undefined;
      patch.customFontLabel = undefined;
    }
    if (book.mathFontId === f.id) patch.mathFontId = "math-stix";
    await removeCustomFont(f.id);
    if (Object.keys(patch).length)
      onApply(patch, `Removed ${f.name} · switched back to the default font`);
    else onNotify(`Removed ${f.name}`);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[560px] max-w-[94vw] max-h-[88vh] flex flex-col bg-white border border-slate-300 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">Fonts</h2>
            <p className="text-[11.5px] text-slate-500">
              Applies to this book’s pages, headings and the printed PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 text-[18px] leading-none text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4">
          {/* Current choices */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                Text font
              </span>
              <select
                value={bodyValue}
                onChange={(e) => pickBody(e.target.value)}
                className="mt-1 w-full border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-slate-900"
              >
                {fonts.length > 0 && (
                  <optgroup label="My fonts">
                    {fonts.map((f) => (
                      <option key={f.id} value={CUSTOM + f.family}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {missingBody && (
                  <option value={bodyValue}>
                    {book.customFontLabel || "Uploaded font"} (not installed)
                  </option>
                )}
                {BODY_GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {FONT_PRESETS.filter((p) => p.group === g).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                Math font
              </span>
              <select
                value={mathValue}
                onChange={(e) => pickMath(e.target.value)}
                className="mt-1 w-full border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-slate-900"
              >
                {fonts.length > 0 && (
                  <optgroup label="My fonts">
                    {fonts.map((f) => (
                      <option key={f.id} value={CUSTOM + f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {missingMath && (
                  <option value={mathValue}>Uploaded font (not installed)</option>
                )}
                <optgroup label="Math">
                  {FONT_PRESETS.filter((p) => p.group === "Math").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>

          {(missingBody || missingMath) && (
            <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
              This book uses an uploaded font that isn’t in this browser. Upload
              the same font file again to restore it — the book will pick it up
              automatically.
            </p>
          )}

          {/* Preview */}
          <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div
              style={{ fontFamily: bodyStack, fontSize: 15, lineHeight: 1.4 }}
              className="text-slate-900"
            >
              <b>1.1 Theory of Equations</b> — The quick brown fox jumps over the
              lazy dog. தமிழ் பாடநூல் 0123456789
            </div>
            <div
              style={{ fontFamily: mathStack, fontSize: 15 }}
              className="text-slate-700 mt-1"
            >
              f(x) = a₀xⁿ + a₁xⁿ⁻¹ + … + aₙ = 0 · α + β + γ = −p
            </div>
          </div>

          {/* Upload */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-[12px] font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Working…" : "Upload font files"}
            </button>
            <span className="text-[11px] text-slate-500">
              .ttf, .otf, .woff, .woff2 · up to 25 MB each
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
              multiple
              className="hidden"
              onChange={onUpload}
            />
          </div>

          {/* Library */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1.5">
              My fonts ({fonts.length})
            </div>
            {fonts.length === 0 ? (
              <p className="text-[12px] text-slate-500">
                No uploaded fonts yet. Fonts you upload are saved in this browser
                and can be used in every Question Bank and Syllabus book.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 border border-slate-200">
                {fonts.map((f) => {
                  const isBody =
                    book.fontId === "custom" && book.customFontFamily === f.family;
                  const isMath = book.mathFontId === f.id;
                  return (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[14px] text-slate-900 truncate"
                          style={{ fontFamily: `"${f.family}", sans-serif` }}
                        >
                          {f.name} — Aa Bb 123 தமிழ்
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate">
                          {f.fileName}
                          {isBody && " · used for text"}
                          {isMath && " · used for math"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => useAsBody(f)}
                        disabled={isBody}
                        className="px-2 py-1 text-[11px] font-semibold border border-slate-300 hover:bg-slate-100 disabled:bg-slate-900 disabled:text-white disabled:border-slate-900"
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => useAsMath(f)}
                        disabled={isMath}
                        className="px-2 py-1 text-[11px] font-semibold border border-slate-300 hover:bg-slate-100 disabled:bg-slate-900 disabled:text-white disabled:border-slate-900"
                      >
                        Math
                      </button>
                      <button
                        type="button"
                        onClick={() => exportFontFile(f)}
                        className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                        title="Download the font file"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(f)}
                        className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => packRef.current?.click()}
              className="px-2.5 py-1 text-[11.5px] font-semibold border border-slate-300 bg-white hover:bg-slate-100"
              title="Import fonts shared from another computer"
            >
              Import font pack
            </button>
            <button
              type="button"
              disabled={fonts.length === 0}
              onClick={() => {
                exportFontPack({
                  fontId: book.fontId,
                  mathFontId: book.mathFontId,
                  customFontFamily: book.customFontFamily,
                  customFontLabel: book.customFontLabel,
                });
                onNotify("Font pack downloaded");
              }}
              className="px-2.5 py-1 text-[11.5px] font-semibold border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              title="Download all your fonts + this book's choices as one file"
            >
              Export font pack
            </button>
            <input
              ref={packRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={onPackImport}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 text-[12px] font-bold text-white bg-slate-900 hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
