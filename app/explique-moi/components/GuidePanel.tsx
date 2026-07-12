"use client";

const TIPS = [
  {
    title: "Soyez précis",
    desc: "Demandez un concept précis ou une comparaison claire, par exemple 'API vs MCP' plutôt que 'parlez-moi des API'.",
  },
  {
    title: "Choisissez le niveau",
    desc: "Utilisez 'Simple' pour une première découverte, 'Approfondir' pour les nuances, les cas d'usage et un exemple concret.",
  },
  {
    title: "Itérez",
    desc: "Cliquez sur 'Approfondir' ou 'Simplifier' pour affiner la réponse sans perdre le fil du concept.",
  },
  {
    title: "Enregistrez",
    desc: "Sauvegardez vos explications dans votre vault Obsidian via Google Drive pour constituer votre base de connaissances.",
  },
];

const EXAMPLES = [
  "La surcharge mentale",
  "REST vs GraphQL",
  "Un bail commercial",
  "L'effet Dunning-Kruger",
  "Kubernetes",
];

interface GuidePanelProps {
  onPickExample: (term: string) => void;
}

export function GuidePanel({ onPickExample }: GuidePanelProps) {
  return (
    <div className="space-y-6 rounded-xl border border-line bg-surface p-5">
      <div>
        <h3 className="font-serif text-lg italic text-gold">Comment utiliser ExpliqueMoi</h3>
        <p className="mt-1 text-[13px] text-muted">
          ExpliqueMoi transforme les concepts complexes en explications claires et actionnables.
        </p>
      </div>

      <div className="space-y-4">
        {TIPS.map((tip, i) => (
          <div key={i} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-mono text-[11px] text-gold">
              {i + 1}
            </span>
            <div>
              <div className="text-[14px] font-medium text-fg">{tip.title}</div>
              <p className="text-[13px] leading-relaxed text-muted">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Exemples</h4>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onPickExample(ex)}
              className="rounded-full border border-line bg-bg px-3 py-1.5 text-[12px] text-fg transition-colors hover:border-gold/40 hover:text-gold"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
