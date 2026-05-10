// Local Document Store
// Provides in-memory + localStorage + IndexedDB persistence for documents
// so uploads work even when Supabase Storage is unavailable.
// IndexedDB stores the PDF file blobs (survives page refresh).
// localStorage stores document metadata + extracted text.

export interface LocalDocument {
  id: string;
  name: string;
  file_path: string;
  status: "pending" | "analyzed";
  folder: string | null;
  file_type: string;
  uploaded_at: string;
  isLocal: boolean;
  extractedText?: string;
}

import { getCurrentUser } from "@/lib/auth";

const user = getCurrentUser() || "guest";

type Listener = () => void;

const STORAGE_KEY = `legal-hub-local-documents-${user}`;
const IDB_NAME = `legal-hub-files-${user}`;
const IDB_STORE = "pdf-blobs";
const IDB_VERSION = 1;

let documents: LocalDocument[] = [];
const listeners = new Set<Listener>();

// In-memory file cache (fast access for current session)
const fileCache = new Map<string, File>();

// Load persisted metadata from localStorage on init
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    documents = JSON.parse(stored);
  }
} catch {
  // ignore parse errors
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch {
    // localStorage might be full — silently degrade
  }
}

function notify() {
  for (const listener of listeners) listener();
}

// ── IndexedDB helpers ───────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a File blob in IndexedDB so it survives page refreshes. */
export async function storeFileInIDB(id: string, file: File): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    // Store as a plain object with arrayBuffer + metadata
    const buffer = await file.arrayBuffer();
    tx.objectStore(IDB_STORE).put(
      { buffer, name: file.name, type: file.type },
      id
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    console.log("Stored PDF blob in IndexedDB for:", file.name);
  } catch (err) {
    console.warn("IndexedDB store failed:", err);
  }
}

/** Retrieve a File blob from IndexedDB (survives refresh). */
export async function getFileFromIDB(id: string): Promise<File | undefined> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    const result = await new Promise<{ buffer: ArrayBuffer; name: string; type: string } | undefined>(
      (resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    if (result) {
      const file = new File([result.buffer], result.name, { type: result.type });
      // Also populate the in-memory cache for subsequent calls
      fileCache.set(id, file);
      console.log("Restored PDF from IndexedDB:", result.name);
      return file;
    }
  } catch (err) {
    console.warn("IndexedDB get failed:", err);
  }
  return undefined;
}

/** Remove a File blob from IndexedDB. */
export async function removeFileFromIDB(id: string): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // non-critical
  }
}

// ── Public API ──────────────────────────────────────────────

export function getLocalDocuments(): LocalDocument[] {
  return documents;
}

export function addLocalDocument(doc: LocalDocument, file?: File): void {
  documents = [doc, ...documents];
  if (file) {
    fileCache.set(doc.id, file);
    // Also persist to IndexedDB for page-refresh survival
    storeFileInIDB(doc.id, file);
  }
  persist();
  notify();
}

export function updateLocalDocument(id: string, updates: Partial<LocalDocument>): void {
  documents = documents.map((d) => (d.id === id ? { ...d, ...updates } : d));
  persist();
  notify();
}

export function removeLocalDocument(id: string): void {
  documents = documents.filter((d) => d.id !== id);
  fileCache.delete(id);
  removeFileFromIDB(id);
  persist();
  notify();
}

/** Retrieve the in-memory File object for a locally-uploaded document. */
export function getCachedFile(id: string): File | undefined {
  return fileCache.get(id);
}

/** Retrieve previously extracted text for a document. */
export function getDocumentText(id: string): string | undefined {
  return documents.find((d) => d.id === id)?.extractedText;
}

// ── React subscription helpers (for useSyncExternalStore) ───

export function subscribeDocuments(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDocumentsSnapshot(): LocalDocument[] {
  return documents;
}
