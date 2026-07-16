// ============================================================
// modeForge.jsx — Mode Forge : LoopForge + Prompt Perfect
// ============================================================

const FORGE_STEPS = [
  { id: 1, label: 'Clarification' },
  { id: 2, label: 'Recherche' },
  { id: 3, label: 'Rédaction' },
  { id: 4, label: 'Critique' },
  { id: 5, label: 'Raffinement' },
  { id: 6, label: 'Terminé' },
];

const PHASE_TO_STEP = {
  'clarification': 1,
  'recherche': 2,
  'rédaction': 3,
  'critique': 4,
  'critique_implementation': 4,
  'raffinement': 5,
  'terminé': 6,
  'erreur': 6,
};

// ── Stepper Forge ─────────────────────────────────────────
function ForgeStepper({ phase }) {
  const step = PHASE_TO_STEP[phase] || 0;
  return (
    <div className="stepper">
      {FORGE_STEPS.map((s, i) => {
        const done = step > s.id;
        const active = step === s.id;
        return (
          <React.Fragment key={s.id}>
            <div className={`step${active ? ' active' : ''}${done ? ' done' : ''}`}>
              <div className="step-dot">
                {done ? <Icon name="check" size={13} sw={3} /> : s.id}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
            {i < FORGE_STEPS.length - 1 && (
              <div className={`step-bar${done ? ' done' : ''}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Chat de clarification ───────────────────────────────────
function ForgeChatStep({ question, onAnswer, loading }) {
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [question]);

  const handleSend = () => {
    if (!input.trim()) return;
    onAnswer(input.trim());
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="chat-wrap">
      <div ref={scrollRef} className="panelbody scroll" style={{ flex: 1 }}>
        <div className="chat">
          <div className="msg bot">
            <div className="who">LoopForge</div>
            {question ? renderMarkdown(question) : <div className="spin-sm" />}
          </div>
        </div>
      </div>
      <div className="chat-footer">
        <div className="chatinput">
          <Textarea value={input} onChange={setInput} onKeyDown={handleKey} rows={2}
            placeholder="Ta réponse… (Shift+Entrée pour envoyer)" />
          <button className="btn btn-ghost btn-icon" onClick={handleSend} disabled={!input.trim() || loading}>
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Livrables (PRD + SPEC + extra) ─────────────────────────
function ForgeDeliverables({ documents, extraDocs, cost, iteration, onDownload, onDownloadAll, onCopy, toast, onComplete }) {
  const { PRD = '', SPEC = '' } = documents || {};
  const { claudeMd = '', ps1Content = '', guide = '' } = extraDocs || {};
  const hasExtra = claudeMd || ps1Content || guide;

  const mkActions = (content, filename) => (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => copyText(content, toast)}><Icon name="copy" size={13} /></button>
      <button className="btn btn-ghost btn-sm" onClick={() => downloadText(content, filename)}><Icon name="download" size={13} /></button>
    </>
  );

  return (
    <div className="chat-wrap">
      <div className="panelbody scroll" style={{ flex: 1 }}>
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Documents générés</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                {cost !== undefined && <>Coût : <b>{cost.toFixed(4)} $</b> · </>}
                {iteration !== undefined && <>{iteration} raffinement(s)</>}
              </div>
            </div>
            <button className="btn btn-soft btn-sm" onClick={onDownloadAll}>
              <Icon name="download" size={13} /> Tout télécharger
            </button>
          </div>

          <Accordion icon="book" title="PRD" defaultOpen actions={mkActions(PRD, 'PRD.md')}>
            <pre className="code scroll" style={{ maxHeight: 300, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap' }}>{PRD}</pre>
          </Accordion>

          <Accordion icon="layers" title="SPEC" actions={mkActions(SPEC, 'SPEC.md')}>
            <pre className="code scroll" style={{ maxHeight: 300, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap' }}>{SPEC}</pre>
          </Accordion>

          {hasExtra && (
            <>
              {claudeMd && (
                <Accordion icon="file" title="CLAUDE.md" actions={mkActions(claudeMd, 'CLAUDE.md')}>
                  <pre className="code scroll" style={{ maxHeight: 260, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap' }}>{claudeMd}</pre>
                </Accordion>
              )}
              {ps1Content && (
                <Accordion icon="terminal" title="setup.ps1" actions={mkActions(ps1Content, 'setup.ps1')}>
                  <pre className="code scroll" style={{ maxHeight: 200, fontSize: 11.5, padding: '14px 18px' }}>{ps1Content}</pre>
                </Accordion>
              )}
              {guide && (
                <Accordion icon="book" title="Guide de démarrage" actions={mkActions(guide, 'guide.md')}>
                  <div style={{ padding: '14px 18px', lineHeight: 1.7 }}>{renderMarkdown(guide)}</div>
                </Accordion>
              )}
            </>
          )}
        </div>
      </div>
      {!hasExtra && onComplete && (
        <div className="chat-footer">
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={onComplete}>
            <Icon name="sparkle" size={14} /> Compléter le projet (CLAUDE.md + PS1 + Guide)
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bibliothèque Forge ────────────────────────────────────
function LibraryForgePane({ lib, onRestore, onDelete, search }) {
  const filtered = search
    ? lib.filter(p => (p.name + (p.objective || '') + (p.context || '')).toLowerCase().includes(search.toLowerCase()))
    : lib;

  if (filtered.length === 0) return (
    <div className="panelbody scroll">
      <EmptyState icon="folder" title="Bibliothèque vide"
        sub="Lance un run Forge et sauvegarde le projet pour le retrouver ici." />
    </div>
  );

  return (
    <div className="panelbody scroll">
      {search && <div style={{ padding: '0 0 10px', fontSize: 12, color: 'var(--mut)' }}>
        {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} pour « {search} »
      </div>}
      <div className="stack" style={{ gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="lib-card">
            <div className="lib-top">
              <div>
                <span className="lib-title">{p.name}</span>
                {p.objective && <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 3, fontFamily: 'var(--mono)' }}>{p.objective.slice(0, 60)}{p.objective.length > 60 ? '…' : ''}</div>}
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
              <span className="langpill">Forge</span>
              <span>{p.date}</span>
              {p.cost_usd !== undefined && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mut)' }}>{p.cost_usd.toFixed(4)} $</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Guide Forge ───────────────────────────────────────────
function GuideForgePane() {
  const steps = [
    ['① Décrire l\'objectif', 'Renseigne l\'objectif produit et le contexte métier/technique. Plus c\'est précis, meilleure est la clarification.'],
    ['② Clarification', 'LoopForge pose des questions ciblées (max 5) pour lever les ambiguïtés bloquantes. Réponds à chaque question.'],
    ['③ Recherche & Rédaction', 'L\'agent analyse le besoin, produit une note de cadrage, puis rédige le PRD et la SPEC technique.'],
    ['④ Critique & Raffinement', 'Deux juges qualité évaluent les documents : le critique rubrique (score /10) et l\'implémenteur simulé (ambiguïtés bloquantes). Boucle de raffinement jusqu\'à convergence.'],
    ['⑤ Livrables', 'PRD et SPEC téléchargeables. Le coût estimé et le nombre d\'itérations sont affichés.'],
  ];
  return (
    <div className="panelbody scroll">
      <div className="stack guide" style={{ gap: 18 }}>
        <div>
          <h3>Mode Forge</h3>
          <p className="lead">Idée → Projet documenté en 5 phases. LoopForge clarifie, recherche, rédige et critique automatiquement.</p>
        </div>
        {steps.map(([title, desc], i) => (
          <div className="guide-block" key={i}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--fg)' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.65 }}>{desc}</div>
          </div>
        ))}
        <div className="guide-block">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="layers" size={14} style={{ color: 'var(--accent)' }} /> Pipeline LoopForge
          </div>
          <pre className="code" style={{ fontSize: 11.5, padding: '10px 14px' }}>
{`START
  │
  ▼
[ask] ──question?──► [answer] ◄── interrupt humain
  │                      │
  ▼                      │
[research] ◄─────────────┘
  │
  ▼
[draft] ──► PRD + SPEC
  │
  ▼
[critique] ──► score /10
  │
  ▼
[implementer_critique] ──► ambiguïtés bloquantes
  │
  ▼
[refine] ◄───────┐ (si score < seuil ou ambiguïtés)
  │              │
  ▼              │
[output] ──► END │`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── ModeForge container ───────────────────────────────────
function ModeForge({ toast, search = '' }) {
  const [objective, setObjective] = React.useState('');
  const [context, setContext] = React.useState('');
  const [runId, setRunId] = React.useState(null);
  const [phase, setPhase] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle | running | waiting_answer | done | error
  const [question, setQuestion] = React.useState('');
  const [documents, setDocuments] = React.useState(null);
  const [cost, setCost] = React.useState(0);
  const [iteration, setIteration] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [extraDocs, setExtraDocs] = React.useState(null); // {claudeMd, ps1Content, guide}
  const [extraLoading, setExtraLoading] = React.useState(false);
  const [rightTab, setRightTab] = React.useState('pipeline');
  const pollingRef = React.useRef(null);

  const [libForge, setLibForge] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('pp-lib-forge') || '[]'); } catch(e) { return []; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('pp-lib-forge', JSON.stringify(libForge)); } catch(e) {}
  }, [libForge]);

  // Auto-switch to library tab when user searches from topbar
  React.useEffect(() => {
    if (search) setRightTab('library');
  }, [search]);

  // ── Polling ──────────────────────────────────────────────
  const startPolling = (id) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const s = await apiForgeGetStatus(id);
        setPhase(s.phase || '');
        setCost(s.cost_usd || 0);
        setIteration(s.iteration || 0);

        if (s.status === 'waiting_answer') {
          setStatus('waiting_answer');
          setQuestion(s.question || '');
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        } else if (s.status === 'done') {
          setStatus('done');
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          // Récupérer les documents
          try {
            const docs = await apiForgeGetDocuments(id);
            setDocuments(docs);
          } catch(e) {}
          toast('ok', 'Run Forge terminé');
        } else if (s.status === 'error') {
          setStatus('error');
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          toast('err', s.error || 'Erreur du run');
        }
      } catch(e) {
        // Ignorer les erreurs de polling transitoires
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => stopPolling();
  }, []);

  // ── Actions ──────────────────────────────────────────────
  const startRun = async () => {
    if (!objective.trim()) {
      toast('err', 'Objectif requis');
      return;
    }
    setLoading(true);
    setStatus('running');
    setPhase('clarification');
    setDocuments(null);
    setExtraDocs(null);
    setQuestion('');
    setCost(0);
    setIteration(0);

    try {
      const res = await apiForgeCreateRun(objective.trim(), context.trim());
      setRunId(res.run_id);
      startPolling(res.run_id);
      toast('info', 'Run Forge démarré');
    } catch(e) {
      setStatus('error');
      toast('err', 'Erreur démarrage: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendAnswer = async (answer) => {
    if (!runId) return;
    setLoading(true);
    try {
      await apiForgeAnswer(runId, answer);
      setStatus('running');
      setQuestion('');
      startPolling(runId);
    } catch(e) {
      toast('err', 'Erreur réponse: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadAll = () => {
    if (!documents) return;
    const files = [
      ['PRD.md', documents.PRD],
      ['SPEC.md', documents.SPEC],
      extraDocs?.claudeMd && ['CLAUDE.md', extraDocs.claudeMd],
      extraDocs?.ps1Content && ['setup.ps1', extraDocs.ps1Content],
      extraDocs?.guide && ['guide.md', extraDocs.guide],
    ].filter(Boolean);
    files.forEach(([fn, content], i) => setTimeout(() => downloadText(content, fn), i * 80));
    toast('ok', `${files.length} fichiers téléchargés`);
  };

  const completeProject = async () => {
    if (!documents) return;
    setExtraLoading(true);
    try {
      // Construire un pseudo-projet pour les fonctions Mode B
      const project = {
        name: objective.trim().slice(0, 40),
        desc: objective.trim(),
        stack: context.trim() || '',
        goals: '',
        domains: ''
      };

      // PRD/SPEC LoopForge en guise de conversation de contexte pour Mode B
      // (tronqué — apiRecommendResources n'a pas de slice interne comme
      // apiGenerateAllDocs/apiGenerateGuide, et le message combiné au
      // catalogue dépasserait MAX_MESSAGE_LENGTH côté /v1/messages)
      const prdSpecExcerpt = `PRD:\n${documents.PRD}\n\nSPEC:\n${documents.SPEC}`.slice(0, 1500);
      const conversation = [
        { role: 'user', content: prdSpecExcerpt }
      ];

      // Recommandations catalogue awesome-claude-code
      const resources = await apiLoadResources();
      const recList = await apiRecommendResources(project, conversation, resources);
      const byId = Object.fromEntries(resources.map(r => [r.id, r]));
      const recsWithContent = await Promise.all(
        recList.map(async rec => {
          const res = byId[rec.id];
          if (!res) return { ...rec, res: null, content: '' };
          const content = await apiLoadResourceFile(res.path);
          return { ...rec, res, content: content || '' };
        })
      );

      // CLAUDE.md (fallback local si l'API échoue, comme Mode B)
      let claudeMd;
      try {
        claudeMd = await apiGenerateClaudeMd(project, recsWithContent);
      } catch(e) {
        claudeMd = buildClaudeMdFallback(project);
        toast('info', 'CLAUDE.md généré en mode local');
      }

      // Documents additionnels (PRD/Architecture/Orchestrateur générés par Mode B)
      let allDocsResult = null;
      try {
        allDocsResult = await apiGenerateAllDocs(project, claudeMd, conversation);
      } catch(e) {
        toast('info', 'Documents additionnels non disponibles');
      }

      // PS1 (registres mémoire + slash-commands recommandées)
      const slashCmds = recsWithContent
        .filter(r => r.res && (r.res.type === 'slash-command' || r.res.type === 'workflow') && r.res.path)
        .map(r => r.res);
      const ps1Content = buildPS1(project, claudeMd, slashCmds, allDocsResult);

      // Guide de démarrage
      const guide = await apiGenerateGuide(project, claudeMd, allDocsResult, conversation);

      setExtraDocs({ claudeMd, ps1Content, guide, recs: recList });
      toast('ok', `Projet complété — ${recList.length} ressources, CLAUDE.md, PS1, guide générés`);
    } catch(e) {
      toast('err', 'Erreur complétion: ' + e.message);
    } finally {
      setExtraLoading(false);
    }
  };

  const saveProject = () => {
    if (!documents || !documents.PRD) { toast('err', 'Génère les documents d\'abord'); return; }
    const item = {
      id: Date.now(),
      name: objective.trim() || 'Projet sans nom',
      objective: objective.trim(),
      context: context.trim(),
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      PRD: documents.PRD,
      SPEC: documents.SPEC,
      cost_usd: cost,
      iteration: iteration,
      claudeMd: extraDocs?.claudeMd || '',
      ps1Content: extraDocs?.ps1Content || '',
      guide: extraDocs?.guide || '',
    };
    setLibForge(l => [item, ...l]);
    toast('ok', `"${item.name}" sauvegardé dans la bibliothèque`);
    setRightTab('library');
  };

  const restoreProject = (p) => {
    setObjective(p.objective || '');
    setContext(p.context || '');
    setDocuments({ PRD: p.PRD || '', SPEC: p.SPEC || '' });
    setExtraDocs(p.claudeMd ? { claudeMd: p.claudeMd, ps1Content: p.ps1Content || '', guide: p.guide || '' } : null);
    setCost(p.cost_usd || 0);
    setIteration(p.iteration || 0);
    setStatus('done');
    setPhase('terminé');
    setRightTab('pipeline');
    toast('info', `Projet "${p.name}" restauré`);
  };

  const resetProject = () => {
    setObjective('');
    setContext('');
    setRunId(null);
    setPhase('');
    setStatus('idle');
    setQuestion('');
    setDocuments(null);
    setExtraDocs(null);
    setCost(0);
    setIteration(0);
    stopPolling();
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="cols">
      {/* LEFT — Formulaire */}
      <div className="col left">
        <SectionTabs tabs={[{ id: 'proj', label: 'Projet' }]} active="proj" onSelect={() => {}} />
        <DictateBar showRestructure={false} />
        <div className="panelbody scroll">
          <div className="stack">
            <Field num="01" label="Objectif">
              <Textarea value={objective} onChange={setObjective} rows={3}
                placeholder="Décris le produit à construire. Ex: Dashboard de suivi de consommation énergétique pour PME…" />
            </Field>
            <Field num="02" label="Contexte" opt>
              <Textarea value={context} onChange={setContext} rows={3}
                placeholder="Contraintes techniques, utilisateurs cibles, stack préféré, périmètre…" />
            </Field>
            <button className="btn btn-primary lg" onClick={startRun} disabled={loading || status === 'running' || extraLoading}>
              {loading
                ? <><div className="spin-sm" style={{ borderTopColor: 'var(--on-accent)' }} /> Lancement…</>
                : <><Icon name="sparkle" size={18} /> Lancer Forge</>
              }
            </button>
            {(status !== 'idle') && (
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={resetProject}>
                ↺ Nouveau projet
              </button>
            )}
            <div className="divider" />
            <div style={{ fontSize: 12, color: 'var(--mut-2)', lineHeight: 1.6 }}>
              LoopForge génère un <b style={{ color: 'var(--mut)' }}>PRD</b> et une{' '}
              <b style={{ color: 'var(--mut)' }}>SPEC technique</b> via une boucle agentique
              (clarification → recherche → rédaction → critique → raffinement).
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — Tabs */}
      <div className="col">
        <SectionTabs
          tabs={[
            { id: 'pipeline', label: 'Pipeline' },
            { id: 'library', label: 'Bibliothèque' },
            { id: 'guide', label: 'Guide' },
          ]}
          active={rightTab} onSelect={setRightTab}
          counts={{ library: libForge.length }} />

        {rightTab === 'pipeline' && (
          <>
            <ForgeStepper phase={phase} />

            {status === 'idle' && (
              <div className="panelbody scroll">
                <EmptyState icon="layers" title="Pipeline en attente"
                  sub="Renseigne ton objectif à gauche puis lance « Lancer Forge » pour démarrer." />
              </div>
            )}

            {status === 'running' && (
              <div className="panelbody scroll">
                <Spinner label={`Phase : ${phase || 'en cours…'}`} />
                <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 8, textAlign: 'center' }}>
                  Polling actif (2s)
                </div>
              </div>
            )}

            {status === 'waiting_answer' && (
              <ForgeChatStep question={question} onAnswer={sendAnswer} loading={loading} />
            )}

            {status === 'done' && documents && (
              <>
                <ForgeDeliverables
                  documents={documents}
                  extraDocs={extraDocs}
                  cost={cost}
                  iteration={iteration}
                  onDownloadAll={downloadAll}
                  onCopy={(text) => copyText(text, toast)}
                  toast={toast}
                  onComplete={!extraDocs ? completeProject : null}
                />
                <div className="chat-footer">
                  <button className="btn btn-soft" style={{ width: '100%', marginBottom: 8 }} onClick={saveProject}>
                    <Icon name="save" size={14} /> Sauvegarder dans la bibliothèque
                  </button>
                </div>
              </>
            )}

            {status === 'error' && (
              <div className="panelbody scroll">
                <EmptyState icon="x" title="Erreur du run"
                  sub="Une erreur s'est produite. Vérifie que l'API LoopForge est démarrée sur localhost:8123." />
              </div>
            )}
          </>
        )}

        {rightTab === 'library' && (
          <LibraryForgePane lib={libForge} search={search}
            onRestore={restoreProject}
            onDelete={p => { setLibForge(l => l.filter(x => x.id !== p.id)); toast('info', 'Projet supprimé'); }} />
        )}

        {rightTab === 'guide' && <GuideForgePane />}
      </div>
    </div>
  );
}

window.ModeForge = ModeForge;
