import { HttpError } from "../http.ts";

export type SourceKind = "pdf" | "png" | "jpeg" | "webp" | "docx";

/** Identify a file by its actual bytes (never trust the extension or client MIME type). */
export function detectKind(buf: Buffer, filename: string): SourceKind {
  const head = buf.subarray(0, 16);
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  // Some PDFs carry a few junk bytes before the header.
  if (buf.subarray(0, 1024).toString("latin1").includes("%PDF-")) return "pdf";
  if (head[0] === 0x89 && head.subarray(1, 4).toString("latin1") === "PNG") return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    if (buf.includes(Buffer.from("word/document.xml"))) return "docx";
    throw new HttpError(415, "unsupported_zip", `"${filename}" is a ZIP archive but not a Word .docx document.`);
  }
  if (head.readUInt32BE(0) === 0xd0cf11e0) {
    throw new HttpError(
      415,
      "legacy_doc",
      `"${filename}" is a legacy Word 97-2003 .doc file. Open it in Word and save as .docx, then upload again.`,
    );
  }
  throw new HttpError(415, "unsupported_type", `"${filename}" is not a supported file. Upload PDF, JPG, PNG, WEBP or DOCX.`);
}
