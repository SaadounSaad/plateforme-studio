"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

type Tab = "split" | "merge";

interface MergeFile {
  id: string;
  file: File;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DropZone({ onFile, accept, multiple, label }: {
  onFile: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  label: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFile(files);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFile(files);
    e.target.value = "";
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors duration-200 " +
        (dragging ? "border-gold/60 bg-gold/5" : "border-line hover:border-gold/40 hover:bg-surface2")
      }
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M12 12v6M9 15l3-3 3 3" />
      </svg>
      <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className="font-mono text-[11px] text-muted/60">Cliquer ou glisser-déposer</span>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={onChange} />
    </div>
  );
}

function SplitTab() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSplit() {
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("ranges", ranges);
      const res = await fetch("/api/pdf/split", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        setError(json.error ?? "Erreur inconnue");
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get("content-disposition") ?? "";
      const match = disp.match(/filename="?([^"]+)"?/);
      downloadBlob(blob, match?.[1] ?? "result.pdf");
    } catch {
      setError("Backend inaccessible. Le service pdf-backend est-il lancé ?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone
        onFile={(files) => setFile(files[0])}
        accept=".pdf"
        label="Déposer un PDF"
      />
      {file && (
        <p className="font-mono text-[12px] text-muted">
          Fichier : <span className="text-fg">{file.name}</span> ({(file.size / 1024).toFixed(0)} Ko)
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Plages de pages</label>
        <input
          type="text"
          value={ranges}
          onChange={(e) => setRanges(e.target.value)}
          placeholder="1-3; 5; 8-12"
          className="rounded-lg border border-line bg-surface px-4 py-2.5 font-mono text-[13px] text-fg placeholder:text-muted/50 focus:border-gold/50 focus:outline-none"
        />
        <p className="font-mono text-[11px] text-muted/70">
          Séparateur <code className="text-gold">;</code> pour plusieurs plages. Ex&nbsp;: <code className="text-muted">1-3; 5; 8-12</code>
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 font-mono text-[12px] text-red-400">{error}</p>
      )}
      <button
        onClick={handleSplit}
        disabled={!file || loading}
        className="flex items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] text-gold transition-colors duration-200 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold/30 border-t-gold"></span>
            Traitement…
          </>
        ) : "Découper"}
      </button>
    </div>
  );
}

function MergeTab() {
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addFiles(newFiles: File[]) {
    const items: MergeFile[] = newFiles.map((f) => ({ id: crypto.randomUUID(), file: f }));
    setFiles((prev) => [...prev, ...items]);
  }

  function remove(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleMerge() {
    if (files.length < 2) return;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f.file));
      const res = await fetch("/api/pdf/merge", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        setError(json.error ?? "Erreur inconnue");
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get("content-disposition") ?? "";
      const match = disp.match(/filename="?([^"]+)"?/);
      downloadBlob(blob, match?.[1] ?? "merged.pdf");
    } catch {
      setError("Backend inaccessible. Le service pdf-backend est-il lancé ?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DropZone
        onFile={addFiles}
        accept=".pdf"
        multiple
        label="Déposer des PDFs (plusieurs)"
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
              <span className="font-mono text-[11px] text-muted/60 w-5 shrink-0 text-right">{i + 1}.</span>
              <span className="flex-1 truncate font-mono text-[12px] text-fg">{f.file.name}</span>
              <span className="font-mono text-[11px] text-muted/50 shrink-0">{(f.file.size / 1024).toFixed(0)} Ko</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-muted hover:text-gold disabled:opacity-30" aria-label="Monter">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="px-1 text-muted hover:text-gold disabled:opacity-30" aria-label="Descendre">↓</button>
              <button onClick={() => remove(f.id)} className="px-1 text-muted hover:text-red-400" aria-label="Supprimer">×</button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 font-mono text-[12px] text-red-400">{error}</p>
      )}
      <button
        onClick={handleMerge}
        disabled={files.length < 2 || loading}
        className="flex items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] text-gold transition-colors duration-200 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gold/30 border-t-gold"></span>
            Traitement…
          </>
        ) : `Fusionner ${files.length > 0 ? `(${files.length} fichiers)` : ""}`}
      </button>
    </div>
  );
}

export default function PdfSplitPage() {
  const [tab, setTab] = useState<Tab>("split");

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: "radial-gradient(120% 60% at 50% -10%, color-mix(in oklab, var(--gold) 9%, transparent), transparent 60%)" }}></div>

      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <a href="/" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold">← Studio</a>
          <span className="font-serif text-[18px] italic text-gold">PDF Split &amp; Merge</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold/90">PDF Folio</p>
        <h1 className="mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-tight tracking-tight text-fg">
          Split &amp; <span className="italic text-gold">Merge</span>
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Découpez un PDF par plages de pages, ou fusionnez plusieurs PDFs en un seul document.
        </p>

        <div className="mt-8 flex gap-1 rounded-lg border border-line bg-surface p-1">
          {(["split", "merge"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "flex-1 rounded-md px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-200 " +
                (tab === t
                  ? "bg-gold/15 text-gold"
                  : "text-muted hover:text-fg")
              }
            >
              {t === "split" ? "Découper" : "Fusionner"}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "split" ? <SplitTab /> : <MergeTab />}
        </div>
      </main>
    </div>
  );
}
