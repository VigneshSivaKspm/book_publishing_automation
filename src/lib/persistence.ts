import type { BookDocument, ContentBlock, PaperSize } from "../types";
import { createNewBook, uid } from "../types";

const DB_NAME = "publication-studio";
const STORE_NAME = "projects";
const LIBRARY_ID = "library";
export const LEGACY_LIBRARY_KEY = "figma.library.v1";
export const CURRENT_SCHEMA_VERSION = 2;

type StoredLibrary = { id: string; schemaVersion: number; books: BookDocument[]; savedAt: string };

function migrateBlock(value: Partial<ContentBlock>, sourcePage: number): ContentBlock {
  return {
    id: typeof value.id === "string" ? value.id : uid("blk"),
    type: value.type || "paragraph",
    text: typeof value.text === "string" ? value.text : "",
    ...value,
    sourcePage: value.sourcePage ?? sourcePage,
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
  } as ContentBlock;
}

export function migrateBook(value: unknown): BookDocument | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<BookDocument>;
  const base = createNewBook(typeof raw.title === "string" ? raw.title : "Recovered publication", {
    paperSize: (raw.paperSize || "REFERENCE_180_240") as PaperSize,
    author: typeof raw.author === "string" ? raw.author : "",
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    bookMode: raw.bookMode === "questions-only" ? "questions-only" : "qa",
  });
  const pages = Array.isArray(raw.pages)
    ? raw.pages.map((page, index) => ({
        id: typeof page?.id === "string" ? page.id : uid("page"),
        number: index + 1,
        notes: typeof page?.notes === "string" ? page.notes : undefined,
        sourcePreviewUrl: typeof page?.sourcePreviewUrl === "string" ? page.sourcePreviewUrl : undefined,
        blocks: Array.isArray(page?.blocks)
          ? page.blocks.map((block) => migrateBlock(block, index + 1))
          : [],
      }))
    : base.pages;
  return {
    ...base,
    ...raw,
    id: typeof raw.id === "string" ? raw.id : base.id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    paperSize: raw.paperSize || "REFERENCE_180_240",
    headerFooter: { ...base.headerFooter, ...(raw.headerFooter || {}) },
    pages: pages.length ? pages : base.pages,
    assets: Array.isArray(raw.assets) ? raw.assets : [],
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedLibrary(): Promise<StoredLibrary | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(LIBRARY_ID);
    request.onsuccess = () => resolve((request.result as StoredLibrary | undefined) || null);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLibrary(): Promise<BookDocument[]> {
  try {
    const stored = await readIndexedLibrary();
    if (stored?.books) return stored.books.map(migrateBook).filter(Boolean) as BookDocument[];
  } catch {
    // IndexedDB may be disabled; the legacy read below is the recovery path.
  }
  try {
    const raw = localStorage.getItem(LEGACY_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const books = Array.isArray(parsed) ? parsed.map(migrateBook).filter(Boolean) as BookDocument[] : [];
    if (books.length) await saveLibrary(books);
    return books;
  } catch {
    return [];
  }
}

export async function saveLibrary(books: BookDocument[]): Promise<void> {
  const payload: StoredLibrary = {
    id: LIBRARY_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    books: books.map((book) => ({ ...book, schemaVersion: CURRENT_SCHEMA_VERSION })),
    savedAt: new Date().toISOString(),
  };
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable");
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  try {
    localStorage.removeItem(LEGACY_LIBRARY_KEY);
  } catch {
    // Removing the migrated legacy copy is optional.
  }
}

export function downloadProjectBackup(book: BookDocument): void {
  const blob = new Blob([JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, book }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${book.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "publication"}.publication.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function restoreProject(file: File): Promise<BookDocument> {
  const parsed = JSON.parse(await file.text()) as { book?: unknown } | unknown;
  const candidate = typeof parsed === "object" && parsed && "book" in parsed ? (parsed as { book: unknown }).book : parsed;
  const book = migrateBook(candidate);
  if (!book) throw new Error("This file is not a valid publication backup.");
  return { ...book, id: uid("book"), updatedAt: new Date().toISOString() };
}
