"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ----------------------------- Icons (thin line) ----------------------------- */
const ic = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const PromptIcon = () => (
  <svg {...ic}>
    <path d="M8.5 8.5 5.5 12l3 3.5" />
    <path d="M15.5 8.5 18.5 12l-3 3.5" />
    <path d="m13 6.5-2 11" opacity=".55" />
    <path d="M19.4 4.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" />
  </svg>
);
const OcrIcon = () => (
  <svg {...ic}>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
    <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
    <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
    <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <path d="M8 10h8M8 13h6" />
  </svg>
);
const SplitIcon = () => (
  <svg {...ic}>
    <rect x="4.5" y="3.5" width="9" height="11" rx="1.4" />
    <path d="M10.5 9.5h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V12" opacity=".55" />
    <path d="M14.5 3.8 12 6.3l2.5 2.5" />
  </svg>
);
const DownloadIcon = () => (
  <svg {...ic}>
    <path d="M12 3.5v10" />
    <path d="m8 10 4 4 4-4" />
    <path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    <path d="M9.5 6.5 12 4l2.5 2.5" opacity=".5" />
  </svg>
);
const ConvertIcon = () => (
  <svg {...ic}>
    <path d="M4 9a7 7 0 0 1 11.5-3.2L18 8" />
    <path d="M18 4v4h-4" />
    <path d="M20 15a7 7 0 0 1-11.5 3.2L6 16" />
    <path d="M6 20v-4h4" />
  </svg>
);
const ExplainIcon = () => (
  <svg {...ic}>
    <path d="M12 3a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1.26A6.98 6.98 0 0 1 5 10a7 7 0 0 1 7-7z" />
    <path d="M9 21h6" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ----------------------------- Types ----------------------------- */
type Tool = { name: string; desc: string; route: string; status: string; Icon: () => React.JSX.Element };

/* ----------------------------- Data ----------------------------- */
const TOOLS: Tool[] = [
  { name: "ExpliqueMoi", desc: "Expliquez n'importe quel concept simplement, avec analogies et exemples concrets.", route: "/explique-moi", status: "available", Icon: ExplainIcon },
  { name: "Prompt Perfect", desc: "Prompts Claude en XML structuré, avec Advisor IA et Skills.", route: "/prompt-perfect", status: "available", Icon: PromptIcon },
  { name: "OCR", desc: "Extrayez le texte de vos images et PDF en un instant.", route: "/ocr", status: "available", Icon: OcrIcon },
  { name: "PDF Split", desc: "Découpez, réorganisez et fusionnez vos documents PDF.", route: "/pdf-split", status: "available", Icon: SplitIcon },
  { name: "Media Downloader", desc: "Téléchargez vidéo et audio depuis n'importe quelle URL.", route: "/media-downloader", status: "available", Icon: DownloadIcon },
  { name: "Convertisseur Vidéo/Audio", desc: "Convertissez vos fichiers entre tous les formats courants.", route: "/convertisseur", status: "soon", Icon: ConvertIcon },
];

/* ----------------------------- Badges ----------------------------- */
function StatusBadge({ status }: { status: string }) {
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-gold">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold"></span>
        </span>
        Disponible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
      <span className="h-1.5 w-1.5 rounded-full border border-muted"></span>
      Bientôt
    </span>
  );
}

/* ----------------------------- Tool Card ----------------------------- */
function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: (t: Tool) => void }) {
  const available = tool.status === "available";
  const { Icon } = tool;
  return (
    <div
      onClick={() => available && onOpen(tool)}
      role={available ? "button" : undefined}
      tabIndex={available ? 0 : undefined}
      onKeyDown={(e) => { if (available && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(tool); } }}
      className={
        "group relative flex flex-col rounded-xl border border-line bg-surface p-5 outline-none " +
        (available
          ? "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-gold/45 hover:bg-surface2 hover:shadow-[0_18px_40px_-22px_rgba(201,168,76,0.5)] focus-visible:border-gold/60"
          : "opacity-55 cursor-default")
      }
    >
      {/* gold corner glow on hover */}
      {available && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/0 to-transparent transition-all duration-500 group-hover:via-gold/60"></div>
      )}

      <div className="flex items-start justify-between">
        <div className={
          "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors duration-300 " +
          (available
            ? "border-line text-fg/80 group-hover:border-gold/40 group-hover:bg-gold/10 group-hover:text-gold"
            : "border-line text-muted")
        }>
          <tool.Icon />
        </div>
        <StatusBadge status={tool.status} />
      </div>

      <h3 className="mt-5 text-[17px] font-semibold leading-tight text-fg">{tool.name}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted text-pretty">{tool.desc}</p>

      <div className="mt-5 flex items-center justify-between border-t border-line/70 pt-3.5">
        <span className="font-mono text-[11px] tracking-tight text-muted/80">{tool.route}</span>
        {available ? (
          <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted transition-colors duration-300 group-hover:text-gold">
            Ouvrir
            <span className="inline-flex translate-x-0 transition-transform duration-300 group-hover:translate-x-0.5"><ArrowIcon /></span>
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted/50">Verrouillé</span>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Theme Toggle ----------------------------- */
function ThemeToggle({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Basculer le thème"
      className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-fg/80 transition-colors duration-300 hover:border-gold/40 hover:text-gold"
    >
      <span className="transition-transform duration-500 group-hover:rotate-45">
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em]">{isDark ? "Sombre" : "Clair"}</span>
    </button>
  );
}

/* ----------------------------- Logo ----------------------------- */
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gold/40 bg-gold/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M3 12h18" opacity=".5" />
          <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />
        </svg>
      </span>
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="text-[18px] font-semibold tracking-tight text-fg">Plateforme</span>
        <span className="font-serif text-[22px] italic text-gold" style={{ lineHeight: 1 }}>Studio</span>
      </span>
    </div>
  );
}


/* ----------------------------- App ----------------------------- */
export default function Home() {
  const [theme, setTheme] = useState("light");
  const router = useRouter();
  
  useEffect(() => {
    const saved = localStorage.getItem("ps-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-fade");
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    localStorage.setItem("ps-theme", theme);
  }, [theme]);

  function openTool(tool: Tool) {
    router.push(tool.route);
  }

  const available = TOOLS.filter(t => t.status === "available").length;

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* subtle warm top glow */}
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: "radial-gradient(120% 60% at 50% -10%, color-mix(in oklab, var(--gold) 9%, transparent), transparent 60%)" }}></div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Intro */}
        <section className="pt-14 pb-10 sm:pt-20 sm:pb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold/90">Plateforme Studio</p>
          <h1 className="mt-4 max-w-2xl font-serif text-[clamp(2.4rem,6vw,4rem)] leading-[1.02] tracking-tight text-fg">
            Vos outils IA, <span className="italic text-gold">en local.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted text-pretty">
            Cinq utilitaires pour générer, extraire, convertir et télécharger — directement sur votre machine, sans rien envoyer ailleurs.
          </p>
        </section>

        {/* Section label */}
        <div className="mb-5 flex items-center gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Outils</span>
          <span className="h-px flex-1 bg-line"></span>
          <span className="font-mono text-[11px] tracking-tight text-muted/70">{available} / {TOOLS.length} disponible{available > 1 ? "s" : ""}</span>
        </div>

        {/* Grid 3 / 2 / 1 */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => <ToolCard key={t.route} tool={t} onOpen={openTool} />)}
        </section>

        {/* Footer */}
        <footer className="mt-16 mb-10 flex items-center justify-center gap-2.5 border-t border-line pt-7">
          <span className="h-1 w-1 rounded-full bg-gold/70"></span>
          <span className="font-mono text-[11.5px] tracking-tight text-muted">Plateforme Studio — Outils IA locaux</span>
        </footer>
      </main>

        </div>
  );
}
