// ============================================================
// modeC.jsx — Fable Booster: auto-routing + prompt boosté
// ============================================================

const TIER_CONFIG = {
  haiku:  { label: 'Haiku 4.5',  model: 'claude-haiku-4-5-20251001', color: '#22c55e', bg: '#f0fdf4', desc: 'Tâche simple · Prompt direct, zéro overhead cognitif' },
  sonnet: { label: 'Sonnet 4.6', model: 'claude-sonnet-4-6',          color: '#3b82f6', bg: '#eff6ff', desc: 'Tâche moyenne · XML structuré + CoT sélectif' },
  opus:   { label: 'Opus 4.8',   model: 'claude-opus-4-8',            color: '#8b5cf6', bg: '#f5f3ff', desc: 'Tâche complexe · CoT forcé + auto-critique → niveau Fable 5' },
  fable:  { label: 'Fable 5',    model: 'claude-fable-5',             color: '#f59e0b', bg: '#fffbeb', desc: 'Frontière · Structure riche + exemples haute qualité' },
};

const DOMAIN_OPTS_C = [
  { v: '',        l: 'Domaine (optionnel)' },
  { v: 'code',    l: 'Code & Architecture' },
  { v: 'redact',  l: 'Rédaction & Contenu' },
  { v: 'analyse', l: 'Analyse & Recherche' },
  { v: 'rh',      l: 'RH & Management' },
  { v: 'data',    l: 'Data & Analytics' },
  { v: 'legal',   l: 'Juridique & Conformité' },
  { v: 'autre',   l: 'Autre' },
];

// ── Tier badge ────────────────────────────────────────────
function TierBadge({ tier, size = 'md' }) {
  const cfg = TIER_CONFIG[tier];
  if (!cfg) return null;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      borderRadius: 20,
      padding: size === 'lg' ? '6px 14px' : '3px 10px',
      fontSize: size === 'lg' ? 13 : 11,
      fontFamily: 'var(--mono)', fontWeight: 700, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 5
    }}>
      <span style={{ width: size === 'lg' ? 7 : 6, height: size === 'lg' ? 7 : 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ── Confidence bar ────────────────────────────────────────
function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 85 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--line)', borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--mut)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ── Tier selector (override) ──────────────────────────────
function TierSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {Object.entries(TIER_CONFIG).map(([k, cfg]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          border: `2px solid ${value === k ? cfg.color : 'var(--line)'}`,
          background: value === k ? cfg.bg : 'transparent',
          color: value === k ? cfg.color : 'var(--mut)',
          borderRadius: 10, padding: '7px 13px', fontSize: 12,
          fontFamily: 'var(--mono)', fontWeight: 600,
          cursor: 'pointer', transition: 'all .15s',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: value === k ? cfg.color : 'var(--mut-2)', transition: 'background .15s' }} />
          {cfg.label}
        </button>
      ))}
    </div>
  );
}

// ── Prompt output block ───────────────────────────────────
function PromptBlock({ label, content, onCopy }) {
  if (!content) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut-2)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
          {label}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onCopy}>
          <Icon name="copy" size={13} /> Copier
        </button>
      </div>
      <div className="codewrap">
        <pre className="code scroll" style={{ maxHeight: 260, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {content}
        </pre>
      </div>
    </div>
  );
}

// ── Guide Mode C ──────────────────────────────────────────
function GuideCPane() {
  const steps = [
    ['① Décrire la tâche', 'Explique l\'objectif, les contraintes, l\'output attendu. Plus c\'est précis, meilleure est la classification.'],
    ['② Classification auto', 'Sonnet analyse la complexité et recommande un tier. Override si ton cas est atypique.'],
    ['③ Génération du prompt boosté', 'Opus génère un system prompt + user template adaptés au tier cible. Chaque tier a sa stratégie propre.'],
    ['④ Utiliser le prompt', 'Copie le system prompt dans Claude.ai ou ton app. Remplace les {{VARIABLES}} dans le user template.'],
  ];
  return (
    <div className="stack guide" style={{ gap: 18 }}>
      <div>
        <h3>Fable Booster</h3>
        <p className="lead">Auto-route ta tâche vers le modèle optimal et génère un prompt qui extrait le maximum de performance — jusqu'au niveau Fable 5.</p>
      </div>
      <div className="guide-block">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="zap" size={14} style={{ color: 'var(--accent)' }} /> Pipeline en 4 étapes
        </div>
        {steps.map(([t, d], i) => (
          <div className="workflow-step" key={i}>
            <div className="ws-num">{i + 1}</div>
            <div><div className="ws-title">{t}</div><div className="ws-desc">{d}</div></div>
          </div>
        ))}
      </div>
      <div className="guide-block">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="layers" size={14} style={{ color: 'var(--accent)' }} /> Tiers de modèles
        </div>
        {Object.entries(TIER_CONFIG).map(([k, cfg]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <TierBadge tier={k} />
            <span style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.55, paddingTop: 2 }}>{cfg.desc}</span>
          </div>
        ))}
      </div>
      <div className="guide-block">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={14} style={{ color: 'var(--accent)' }} /> Opus → niveau Fable 5
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.65 }}>
          Le booster Opus active 5 mécanismes : <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>&lt;thinking&gt;</code> forcé avant chaque réponse, décomposition obligatoire des sous-problèmes, calibration "expert mondial", auto-critique constitutionnelle, et protocole d'incertitude explicite. Cela réduit significativement l'écart de performance avec Fable 5.
        </div>
      </div>
    </div>
  );
}

// ── Library C pane ────────────────────────────────────────
function LibraryCPane({ libC, onRestore, onDelete }) {
  if (libC.length === 0) return (
    <EmptyState icon="sparkle" title="Bibliothèque vide"
      sub="Génère un prompt boosté et sauvegarde-le pour le retrouver ici." />
  );
  return (
    <div className="stack" style={{ gap: 12 }}>
      {libC.map(p => (
        <div key={p.id} className="lib-card">
          <div className="lib-top">
            <div>
              <TierBadge tier={p.tier} />
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 7, color: 'var(--fg)' }}>{p.task}</div>
            </div>
            <div className="lib-actions">
              <button className="act" title="Restaurer" onClick={() => onRestore(p)}>
                <Icon name="restore" size={14} />
              </button>
              <button className="act danger" title="Supprimer" onClick={() => onDelete(p)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
          <div className="lib-meta" style={{ marginTop: 8 }}>
            <span className="langpill">BOOST</span>
            <span>{p.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ModeC container ───────────────────────────────────────
function ModeC({ toast }) {
  const [taskDesc, setTaskDesc] = React.useState('');
  const [domain,   setDomain]   = React.useState('');
  // phase: 'input' | 'classifying' | 'classified' | 'generating' | 'done'
  const [phase,    setPhase]    = React.useState('input');
  const [classif,  setClassif]  = React.useState(null);
  const [selTier,  setSelTier]  = React.useState(null);
  const [result,   setResult]   = React.useState(null);
  const [rightTab, setRightTab] = React.useState('analyse');

  const [libC, setLibC] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('pp-lib-c') || '[]'); } catch(e) { return []; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('pp-lib-c', JSON.stringify(libC)); } catch(e) {}
  }, [libC]);

  const loading = phase === 'classifying' || phase === 'generating';

  const reset = () => {
    setPhase('input'); setClassif(null); setSelTier(null); setResult(null);
    setRightTab('analyse');
  };

  const classify = async () => {
    if (!taskDesc.trim()) { toast('err', 'Décris la tâche d\'abord'); return; }
    setPhase('classifying');
    setRightTab('analyse');
    try {
      const c = await apiClassifyTask(taskDesc);
      setClassif(c);
      setSelTier(c.tier);
      setPhase('classified');
      toast('ok', `Tier détecté : ${TIER_CONFIG[c.tier]?.label}`);
    } catch(e) {
      toast('err', 'Erreur classification : ' + e.message);
      setPhase('input');
    }
  };

  const generate = async () => {
    if (!selTier) return;
    setPhase('generating');
    setRightTab('prompt');
    try {
      const res = await apiGenerateBoostedPrompt(taskDesc, selTier, domain);
      setResult(res);
      setPhase('done');
      toast('ok', 'Prompt boosté généré');
    } catch(e) {
      toast('err', 'Erreur génération : ' + e.message);
      setPhase('classified');
    }
  };

  const save = () => {
    if (!result) return;
    const item = {
      id: Date.now(),
      task: taskDesc.slice(0, 80) + (taskDesc.length > 80 ? '…' : ''),
      tier: selTier,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      ...result
    };
    setLibC(l => [item, ...l]);
    toast('ok', 'Sauvegardé dans la bibliothèque');
  };

  const restore = (p) => {
    setResult({ system_prompt: p.system_prompt, user_template: p.user_template, variables: p.variables, usage_tips: p.usage_tips, cot_required: p.cot_required });
    setSelTier(p.tier);
    setPhase('done');
    setRightTab('prompt');
    toast('info', 'Prompt restauré');
  };

  // ── Left panel ────────────────────────────────────────────
  const leftPanel = (
    <div className="stack">
      <Field num="01" label="Décris ta tâche">
        <Textarea value={taskDesc} onChange={setTaskDesc} rows={6} disabled={loading}
          placeholder="Ex: Analyser un contrat de 30 pages, identifier les clauses abusives, résumer les obligations de chaque partie et proposer des amendements selon le droit marocain du travail..." />
      </Field>
      <div>
        <span className="minilabel">Domaine</span>
        <Select value={domain} onChange={setDomain} options={DOMAIN_OPTS_C} disabled={loading} />
      </div>

      {(phase === 'input' || phase === 'classifying') && (
        <button className="btn btn-primary lg" onClick={classify} disabled={loading || !taskDesc.trim()}>
          {phase === 'classifying'
            ? <><div className="spin-sm" style={{ borderTopColor: 'var(--on-accent)' }} /> Analyse en cours…</>
            : <><Icon name="zap" size={18} /> Analyser la complexité</>}
        </button>
      )}

      {(phase === 'classified' || phase === 'generating' || phase === 'done') && classif && (
        <>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>Modèle recommandé</span>
              <TierBadge tier={selTier} size="lg" />
            </div>
            <ConfidenceBar value={classif.confidence} />
            <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.55 }}>{classif.justification}</div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--mut-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Changer de tier
              </div>
              <TierSelector value={selTier} onChange={setSelTier} />
            </div>
          </div>

          <button className="btn btn-primary lg" onClick={generate} disabled={phase === 'generating'}>
            {phase === 'generating'
              ? <><div className="spin-sm" style={{ borderTopColor: 'var(--on-accent)' }} /> Génération par Opus…</>
              : <><Icon name="sparkle" size={18} /> Générer le prompt boosté</>}
          </button>
          <button className="btn btn-ghost" onClick={reset} style={{ width: '100%' }}>
            ↺ Nouvelle tâche
          </button>
        </>
      )}
    </div>
  );

  // ── Right: Analyse tab ────────────────────────────────────
  const analyseTab = (
    <div className="stack" style={{ gap: 14 }}>
      {phase === 'classifying' && <Spinner label="Sonnet analyse la complexité de la tâche…" />}

      {!classif && phase !== 'classifying' && (
        <EmptyState icon="zap" title="Analyse en attente"
          sub="Décris ta tâche et clique « Analyser la complexité » pour obtenir la recommandation de modèle." />
      )}

      {classif && (
        <>
          <div style={{
            background: 'var(--card)',
            border: `2px solid ${(TIER_CONFIG[selTier]?.color || 'var(--accent)') + '40'}`,
            borderRadius: 14, padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Tier recommandé</div>
              <TierBadge tier={selTier} size="lg" />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.6, marginBottom: 12 }}>
              {TIER_CONFIG[selTier]?.desc}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Confiance
            </div>
            <ConfidenceBar value={classif.confidence} />
          </div>

          {classif.signals?.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--mut-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Signaux détectés
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {classif.signals.map((s, i) => (
                  <span key={i} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--mut)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.6, padding: '0 2px' }}>
            <strong style={{ color: 'var(--fg)' }}>Justification :</strong> {classif.justification}
          </div>
        </>
      )}
    </div>
  );

  // ── Right: Prompt tab ─────────────────────────────────────
  const promptTab = (
    <div className="stack" style={{ gap: 16 }}>
      {phase === 'generating' && <Spinner label="Opus génère le prompt boosté…" />}

      {!result && phase !== 'generating' && (
        <EmptyState icon="sparkle" title="Prompt en attente"
          sub="Lance l'analyse puis clique « Générer le prompt boosté »." />
      )}

      {result && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TierBadge tier={selTier} size="lg" />
            {result.cot_required && (
              <span style={{
                background: 'var(--accent-soft)', color: 'var(--accent)',
                border: '1px solid var(--accent)22', borderRadius: 20,
                padding: '4px 10px', fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600
              }}>
                CoT forcé
              </span>
            )}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={save}>
              <Icon name="save" size={13} /> Sauvegarder
            </button>
          </div>

          <PromptBlock
            label="System Prompt"
            content={result.system_prompt}
            onCopy={() => copyText(result.system_prompt, toast, 'System prompt copié')}
          />

          <PromptBlock
            label="User Template"
            content={result.user_template}
            onCopy={() => copyText(result.user_template, toast, 'User template copié')}
          />

          {result.variables?.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--mut-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Variables à remplacer
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.variables.map(v => (
                  <code key={v} style={{
                    fontFamily: 'var(--mono)', background: 'var(--accent-soft)',
                    border: '1px solid var(--accent)22', borderRadius: 6,
                    padding: '3px 9px', fontSize: 12, color: 'var(--accent)'
                  }}>
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          {result.usage_tips?.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--mut-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Conseils d'utilisation
              </div>
              {result.usage_tips.map((tip, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.55, marginBottom: 5, display: 'flex', gap: 7 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-soft" style={{ width: '100%' }}
            onClick={() => copyText((result.system_prompt || '') + '\n\n---\n\n' + (result.user_template || ''), toast, 'Prompt complet copié')}>
            <Icon name="copy" size={14} /> Copier le prompt complet
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="cols">
      {/* LEFT */}
      <div className="col left">
        <SectionTabs tabs={[{ id: 'task', label: 'Tâche' }]} active="task" onSelect={() => {}} />
        <DictateBar showRestructure={false} />
        <div className="panelbody scroll">{leftPanel}</div>
      </div>

      {/* RIGHT */}
      <div className="col">
        <SectionTabs
          tabs={[
            { id: 'analyse', label: 'Analyse' },
            { id: 'prompt',  label: 'Prompt' },
            { id: 'library', label: 'Bibliothèque' },
            { id: 'guide',   label: 'Guide' },
          ]}
          active={rightTab} onSelect={setRightTab}
          counts={{ library: libC.length }} />
        <div className="panelbody scroll">
          {rightTab === 'analyse'  && analyseTab}
          {rightTab === 'prompt'   && promptTab}
          {rightTab === 'library'  && (
            <LibraryCPane libC={libC}
              onRestore={restore}
              onDelete={p => { setLibC(l => l.filter(x => x.id !== p.id)); toast('info', 'Supprimé'); }} />
          )}
          {rightTab === 'guide'    && <GuideCPane />}
        </div>
      </div>
    </div>
  );
}

window.ModeC = ModeC;
window.TIER_CONFIG = TIER_CONFIG;
