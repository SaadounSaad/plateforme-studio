// ============================================================
// modeB.jsx — Générateur de projets Claude Code (Mode B)
// ============================================================

const B_STEPS = [
  { id: 1, label: 'Brainstorm' },
  { id: 2, label: 'Recommandations' },
  { id: 3, label: 'Livrables' },
  { id: 4, label: 'Scaffold' },
  { id: 5, label: 'Guide' },
];

// ── Stepper ───────────────────────────────────────────────
function Stepper({ step, onGoTo }) {
  return (
    <div className="stepper">
      {B_STEPS.map((s, i) => {
        const done = step > s.id;
        return (
          <React.Fragment key={s.id}>
            <div
              className={`step${step === s.id ? ' active' : ''}${done ? ' done' : ''}${done ? ' nav' : ''}`}
              onClick={() => done && onGoTo && onGoTo(s.id)}
              title={done ? `Revenir à ${s.label}` : undefined}
            >
              <div className="step-dot">
                {done ? <Icon name="check" size={13} sw={3} /> : s.id}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
            {i < B_STEPS.length - 1 && (
              <div className={`step-bar${done ? ' done' : ''}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── ① Chat brainstorm ─────────────────────────────────────
function ChatStep({ messages, input, setInput, onSend, onNext, nextLabel, onViewRecs, loading }) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="chat-wrap">
      <div ref={scrollRef} className="panelbody scroll" style={{ flex: 1 }}>
        <div className="chat">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>
              <div className="who">{m.who === 'bot' ? 'Claude' : 'Vous'}</div>
              {m.who === 'bot' ? renderMarkdown(m.text) : m.text}
            </div>
          ))}
          {loading && (
            <div className="msg bot">
              <div className="who">Claude</div>
              <div className="spin-sm" />
            </div>
          )}
        </div>
      </div>
      <div className="chat-footer">
        <div className="chatinput">
          <Textarea value={input} onChange={setInput} onKeyDown={handleKey} rows={2}
            placeholder="Affine ton projet en dialogue… (Shift+Entrée pour envoyer)" />
          <button className="btn btn-ghost btn-icon" onClick={onSend} disabled={!input.trim() || loading}>
            <Icon name="send" size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {onViewRecs && (
            <button className="btn btn-ghost" onClick={onViewRecs}>
              Voir les reco. <Icon name="arrowRight" size={14} />
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
            {nextLabel || 'Générer les recommandations'} <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ② Recommandations ─────────────────────────────────────
function RecoStep({ recs, resources, selected, toggle, onNext, onBack, nextLabel }) {
  const byId = Object.fromEntries((resources || []).map(r => [r.id, r]));
  const typeClass = t => t === 'slash-command' ? 'type-slash' : t === 'workflow' ? 'type-workflow' : t === 'claude-md' ? 'type-claudemd' : 'type-skill';
  const typeLabel = t => t === 'slash-command' ? '/command' : t === 'claude-md' ? 'CLAUDE.md' : t;

  return (
    <div className="chat-wrap">
      <div className="panelbody scroll" style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 14, lineHeight: 1.6 }}>
          Sélectionne les ressources à installer dans le projet.{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="reco">
          {recs.map(rec => {
            const res = byId[rec.id];
            if (!res) return null;
            const on = selected.includes(rec.id);
            return (
              <div key={rec.id} className={`reco-card${on ? ' sel' : ''}`} onClick={() => toggle(rec.id)}>
                <div className="reco-check"><Icon name="check" size={13} sw={3} /></div>
                <span className={`type-badge ${typeClass(res.type)}`}>{typeLabel(res.type)}</span>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 600, margin: '10px 0 6px', color: 'var(--fg)' }}>
                  {res.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.55 }}>{res.description}</div>
                {rec.justification && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
                    ↳ {rec.justification}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="chat-footer">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Modifier</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext} disabled={!selected.length}>
            {nextLabel || 'Générer les livrables'} <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File tree scaffold ────────────────────────────────────
function ScaffoldTree({ project, selectedRecs, resources }) {
  const name = (project.name || 'mon-projet').toLowerCase().replace(/[^\w]+/g, '-');
  const byId = Object.fromEntries((resources || []).map(r => [r.id, r]));
  const selRes = selectedRecs.map(id => byId[id]).filter(Boolean);
  const slash = selRes.filter(r => r.type === 'slash-command' || r.type === 'workflow');
  const skills = selRes.filter(r => r.type === 'skill');
  return (
    <div className="filetree">
      <div><span className="dir">{name}/</span></div>
      <div>├─ <span className="dir">.claude/</span></div>
      {slash.length > 0 && <div>│&nbsp;&nbsp;├─ <span className="dir">commands/</span></div>}
      {slash.map((r, i, a) => (
        <div key={r.id}>│&nbsp;&nbsp;│&nbsp;&nbsp;{i === a.length - 1 ? '└─' : '├─'}{' '}
          <span className="file">{r.id}.md</span>
        </div>
      ))}
      {skills.length > 0 && <div>│&nbsp;&nbsp;└─ <span className="dir">agents/skills/</span></div>}
      {skills.map((r, i, a) => (
        <div key={r.id}>│&nbsp;&nbsp;&nbsp;&nbsp;{i === a.length - 1 ? '└─' : '├─'}{' '}
          <span className="file">{r.id}/</span>
        </div>
      ))}
      <div>├─ <span className="file">CLAUDE.md</span></div>
      <div>├─ <span className="dir">src/</span></div>
      <div>└─ <span className="file">package.json</span></div>
    </div>
  );
}

// ── ③ Livrables ───────────────────────────────────────────
function DeliverablesStep({ project, claudeMd, ps1Content, allDocs, selectedRecs, resources, toast, onNext, onBack, onRegenerate }) {
  if (!claudeMd) return (
    <div className="panelbody scroll">
      <Spinner label="Génération des documents avec Claude…" />
    </div>
  );

  const slug = (project.name || 'projet').toLowerCase().replace(/[^\w]+/g, '-');

  const downloadAll = () => {
    const files = [
      ['CLAUDE.md', claudeMd],
      allDocs?.prd           && ['PRD.md', allDocs.prd],
      allDocs?.architecture  && ['ARCHITECTURE.md', allDocs.architecture],
      allDocs?.orchestrateur && ['orchestrateur.md', allDocs.orchestrateur],
      [`setup-${slug}.ps1`, ps1Content],
    ].filter(Boolean);
    files.forEach(([fn, content], i) => setTimeout(() => downloadText(content, fn), i * 80));
    toast('ok', `${files.length} fichiers téléchargés`);
  };

  const fileCount = [claudeMd, allDocs?.prd, allDocs?.architecture, allDocs?.orchestrateur, ps1Content].filter(Boolean).length;
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
          <Accordion icon="file" title="CLAUDE.md" defaultOpen actions={mkActions(claudeMd, 'CLAUDE.md')}>
            <pre className="code scroll" style={{ maxHeight: 240, fontSize: 11.5, padding: '14px 18px' }}>
              <XMLView src={claudeMd} />
            </pre>
          </Accordion>

          {allDocs?.prd && (
            <Accordion icon="book" title="PRD.md" actions={mkActions(allDocs.prd, 'PRD.md')}>
              <pre className="code scroll" style={{ maxHeight: 220, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap' }}>{allDocs.prd}</pre>
            </Accordion>
          )}

          {allDocs?.architecture && (
            <Accordion icon="layers" title="ARCHITECTURE.md" actions={mkActions(allDocs.architecture, 'ARCHITECTURE.md')}>
              <pre className="code scroll" style={{ maxHeight: 220, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap' }}>{allDocs.architecture}</pre>
            </Accordion>
          )}

          {allDocs?.orchestrateur && (
            <Accordion icon="command" title="orchestrateur.md" actions={mkActions(allDocs.orchestrateur, 'orchestrateur.md')}>
              <pre className="code scroll" style={{ maxHeight: 220, fontSize: 11.5, padding: '14px 18px', whiteSpace: 'pre-wrap' }}>{allDocs.orchestrateur}</pre>
            </Accordion>
          )}

          <Accordion icon="terminal" title={`setup-${slug}.ps1`} actions={mkActions(ps1Content, `setup-${slug}.ps1`)}>
            <pre className="code scroll" style={{ maxHeight: 200, fontSize: 11.5, padding: '14px 18px' }}>{ps1Content}</pre>
          </Accordion>

          <Accordion icon="folder" title="Structure du projet">
            <div style={{ padding: '8px 16px 16px' }}>
              <ScaffoldTree project={project} selectedRecs={selectedRecs} resources={resources} />
            </div>
          </Accordion>
        </div>
      </div>
      <div className="chat-footer">
        <button className="btn btn-soft" style={{ width: '100%', marginBottom: 8 }} onClick={downloadAll}>
          <Icon name="download" size={14} /> Télécharger tout ({fileCount} fichiers)
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Recommandations</button>
          {onRegenerate && (
            <button className="btn btn-ghost" onClick={onRegenerate} title="Régénérer avec le contexte du chat actuel">
              <Icon name="sparkle" size={13} /> Régénérer
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
            Voir le scaffold final <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ④ Scaffold ────────────────────────────────────────────
function ScaffoldStep({ project, ps1Content, toast, onBack, onSave, onNext, guideExists }) {
  const slug = (project.name || 'projet').toLowerCase().replace(/[^\w]+/g, '-');
  return (
    <div className="chat-wrap">
      <div className="panelbody scroll" style={{ flex: 1 }}>
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name="check" size={16} sw={3} />
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Script prêt à exécuter</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                Lance-le dans PowerShell à la racine de ton workspace.
              </div>
            </div>
          </div>
          <div className="codewrap">
            <div className="codebar">
              <span className="meta"><Icon name="terminal" size={13} /> setup.ps1</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => downloadText(ps1Content, `setup-${slug}.ps1`)}>
                  <Icon name="download" size={13} /> Télécharger
                </button>
                <button className="btn btn-soft btn-sm" onClick={() => copyText(ps1Content, toast)}>
                  <Icon name="copy" size={13} /> Copier
                </button>
              </div>
            </div>
            <pre className="code scroll" style={{ maxHeight: 400, fontSize: 11.5 }}>{ps1Content}</pre>
          </div>
        </div>
      </div>
      <div className="chat-footer">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Livrables</button>
          <button className="btn btn-ghost" onClick={onSave}>
            <Icon name="save" size={14} /> Sauvegarder
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
            {guideExists ? 'Voir le guide' : 'Guide de démarrage'} <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ⑤ Guide de démarrage ──────────────────────────────────
function GuideStep({ guide, project, toast, onBack, onSave, onRegenerate }) {
  if (!guide) return (
    <div className="panelbody scroll">
      <Spinner label="Génération du guide de démarrage…" />
    </div>
  );
  const slug = (project.name || 'projet').toLowerCase().replace(/[^\w]+/g, '-');
  return (
    <div className="chat-wrap">
      <div className="panelbody scroll" style={{ flex: 1 }}>
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 4px' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>Guide de démarrage</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Étapes pour lancer le projet avec Claude Code</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => copyText(guide, toast)}><Icon name="copy" size={13} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadText(guide, `guide-${slug}.md`)}><Icon name="download" size={13} /></button>
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 22px', lineHeight: 1.7 }}>
            {renderMarkdown(guide)}
          </div>
        </div>
      </div>
      <div className="chat-footer">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onBack}>← Scaffold</button>
          <button className="btn btn-ghost" onClick={onRegenerate} title="Régénérer le guide">
            <Icon name="sparkle" size={13} /> Régénérer
          </button>
          <button className="btn btn-soft" style={{ flex: 1 }} onClick={onSave}>
            <Icon name="save" size={14} /> Sauvegarder dans la bibliothèque
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LibraryB pane ─────────────────────────────────────────
function LibraryBPane({ libB, onRestore, onDelete, search }) {
  const filtered = search
    ? libB.filter(p => (p.name + (p.stack || '') + (p.desc || '')).toLowerCase().includes(search.toLowerCase()))
    : libB;

  if (filtered.length === 0) return (
    <div className="panelbody scroll">
      <EmptyState icon="folder" title="Bibliothèque vide"
        sub="Lance le pipeline et sauvegarde un projet depuis l'étape Scaffold pour le retrouver ici." />
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
                {p.stack && <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 3, fontFamily: 'var(--mono)' }}>{p.stack}</div>}
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
              <span className="langpill">CC</span>
              <span>{p.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Guide CC pane ─────────────────────────────────────────
const CC_GUIDE_STEPS = [
  ['① Brainstorm', 'Décris ton projet (nom, description, stack, objectifs). Claude pose des questions ciblées pour affiner l\'analyse. Réponds aux questions, puis clique « Générer les recommandations ».'],
  ['② Recommandations', 'Claude analyse le catalogue awesome-claude-code et sélectionne les slash-commands, workflows et skills les plus adaptés. Tu peux ajuster la sélection.'],
  ['③ Livrables', 'Génération automatique : un CLAUDE.md personnalisé (instructions, stack, standards) et un script PowerShell setup.ps1 prêt à exécuter.'],
  ['④ Scaffold', 'Télécharge ou copie le script PS1. Lance-le dans PowerShell : il crée le dossier, installe les slash-commands et génère CLAUDE.md en une commande.'],
];

function GuideBPane() {
  return (
    <div className="panelbody scroll">
      <div className="stack guide" style={{ gap: 18 }}>
        <div>
          <h3>Pipeline Claude Code</h3>
          <p className="lead">4 étapes pour configurer Claude Code sur un nouveau projet : du brainstorm au scaffold automatisé.</p>
        </div>
        {CC_GUIDE_STEPS.map(([title, desc], i) => (
          <div key={i} className="guide-block">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--fg)' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.65 }}>{desc}</div>
          </div>
        ))}
        <div className="guide-block">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="file" size={14} style={{ color: 'var(--accent)' }} /> Structure générée
          </div>
          <pre className="code" style={{ fontSize: 11.5, padding: '10px 14px' }}>
{`mon-projet/
├─ .claude/
│  ├─ commands/
│  │  ├─ commit.md
│  │  └─ context-prime.md
│  └─ agents/skills/
├─ CLAUDE.md
├─ src/
└─ package.json`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── ModeB container ───────────────────────────────────────
function ModeB({ toast, search = '' }) {
  // Initialize project directly from localStorage to avoid mount-overwrite bug
  const [project, setProject] = React.useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('pp_session_b') || '{}');
      return s.project || EMPTY_PROJECT_B;
    } catch(e) { return EMPTY_PROJECT_B; }
  });
  const [step, setStep]       = React.useState(0);
  const [rightTab, setRightTab] = React.useState('pipeline');
  const [messages, setMessages] = React.useState([]);
  const [chatInput, setChatInput] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);
  const [recs, setRecs]       = React.useState([]);
  const [resources, setResources] = React.useState([]);
  const [selected, setSelected] = React.useState([]);
  const [claudeMd, setClaudeMd] = React.useState(null);
  const [ps1Content, setPs1Content] = React.useState(null);
  const [allDocs, setAllDocs] = React.useState(null);
  const [guide, setGuide] = React.useState(null);
  const [genLoading, setGenLoading] = React.useState(false);
  const conversationRef = React.useRef([]);

  const [libB, setLibB] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('pp-lib-b') || '[]'); } catch(e) { return []; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('pp-lib-b', JSON.stringify(libB)); } catch(e) {}
  }, [libB]);

  // Auto-switch to library tab when user searches from topbar
  React.useEffect(() => {
    if (search) setRightTab('library');
  }, [search]);

  const setP = (k, v) => setProject(p => ({ ...p, [k]: v }));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  // Save project form data on every change
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('pp_session_b');
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem('pp_session_b', JSON.stringify({ ...existing, project }));
    } catch(e) {}
  }, [project]);

  // Restore session on mount (project already initialized above)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('pp_session_b');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.step) setStep(s.step);
      if (s.recs) setRecs(s.recs);
      if (s.resources) setResources(s.resources);
      if (s.selected) setSelected(s.selected);
      if (s.claudeMd) setClaudeMd(s.claudeMd);
      if (s.ps1Content) setPs1Content(s.ps1Content);
      if (s.allDocs) setAllDocs(s.allDocs);
      if (s.guide) setGuide(s.guide);
      if (s.conversation) conversationRef.current = s.conversation;
      if (s.messages) setMessages(s.messages);
    } catch(e) {}
  }, []);

  const saveSession = (updates = {}) => {
    try {
      const data = {
        project, step, recs, resources, selected, claudeMd, ps1Content, allDocs, guide,
        conversation: conversationRef.current, messages,
        ...updates
      };
      localStorage.setItem('pp_session_b', JSON.stringify(data));
    } catch(e) {}
  };

  // ① Analyze & start brainstorm
  const analyze = async () => {
    if (!project.name.trim() || !project.desc.trim()) {
      toast('err', 'Nom et description du projet requis');
      return;
    }
    conversationRef.current = [];
    setMessages([]);
    setStep(1);
    setChatLoading(true);

    const projectCtx = [
      `Nom: ${project.name}`,
      `Description: ${project.desc}`,
      project.stack   ? `Stack: ${project.stack}` : '',
      project.goals   ? `Phases: ${project.goals}` : '',
      project.domains ? `Domaines: ${project.domains}` : '',
    ].filter(Boolean).join('\n');

    const firstMsg = `Voici mon projet :\n\n${projectCtx}`;
    conversationRef.current = [{ role: 'user', content: firstMsg }];

    try {
      const reply = await apiBrainstormChat(conversationRef.current);
      conversationRef.current.push({ role: 'assistant', content: reply });
      const msgs = [{ who: 'bot', text: reply }];
      setMessages(msgs);
      toast('info', 'Brainstorm démarré');
      saveSession({ step: 1, messages: msgs, conversation: conversationRef.current });
    } catch(e) {
      const fallback = `Super, « ${project.name} ». Dis-m'en plus sur les contraintes et les cas d'usage prioritaires — je proposerai ensuite les ressources Claude Code adaptées.`;
      conversationRef.current.push({ role: 'assistant', content: fallback });
      const msgs = [{ who: 'bot', text: fallback }];
      setMessages(msgs);
      toast('info', 'Mode hors-ligne');
      saveSession({ step: 1, messages: msgs });
    } finally {
      setChatLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const u = chatInput.trim();
    setChatInput('');
    conversationRef.current.push({ role: 'user', content: u });
    const newMsgs = [...messages, { who: 'user', text: u }];
    setMessages(newMsgs);
    setChatLoading(true);
    try {
      const reply = await apiBrainstormChat(conversationRef.current);
      conversationRef.current.push({ role: 'assistant', content: reply });
      const finalMsgs = [...newMsgs, { who: 'bot', text: reply }];
      setMessages(finalMsgs);
      saveSession({ messages: finalMsgs, conversation: conversationRef.current });
    } catch(e) {
      const fallback = 'Noté. Clique « Générer les recommandations » quand tu es prêt.';
      conversationRef.current.push({ role: 'assistant', content: fallback });
      const finalMsgs = [...newMsgs, { who: 'bot', text: fallback }];
      setMessages(finalMsgs);
    } finally {
      setChatLoading(false);
    }
  };

  // ② Load resources + get recommendations
  const goRecommend = async () => {
    setStep(2);
    setGenLoading(true);
    setRecs([]);
    try {
      const res = await apiLoadResources();
      setResources(res);
      const recList = await apiRecommendResources(project, conversationRef.current, res);
      setRecs(recList);
      const ids = recList.map(r => r.id);
      setSelected(ids);
      toast('ok', `${recList.length} ressources recommandées`);
      saveSession({ step: 2, recs: recList, resources: res, selected: ids });
    } catch(e) {
      toast('err', 'Erreur chargement ressources: ' + e.message);
      setStep(1);
    } finally {
      setGenLoading(false);
    }
  };

  // ③ Generate CLAUDE.md + all docs + PS1
  const goLivrables = async () => {
    setStep(3);
    setClaudeMd(null);
    setPs1Content(null);
    setAllDocs(null);
    setGenLoading(true);

    try {
      // Load selected resource contents
      const byId = Object.fromEntries(resources.map(r => [r.id, r]));
      const recsWithContent = await Promise.all(
        recs.filter(rec => selected.includes(rec.id)).map(async rec => {
          const res = byId[rec.id];
          if (!res) return { ...rec, res: null, content: '' };
          const content = await apiLoadResourceFile(res.path);
          return { ...rec, res, content: content || '' };
        })
      );

      // Generate CLAUDE.md
      let md;
      try {
        md = await apiGenerateClaudeMd(project, recsWithContent);
      } catch(e) {
        md = buildClaudeMdFallback(project);
        toast('info', 'CLAUDE.md généré en mode local');
      }
      setClaudeMd(md);

      // Generate PRD + Architecture + Orchestrateur
      let allDocsResult = null;
      try {
        allDocsResult = await apiGenerateAllDocs(project, md, conversationRef.current);
        setAllDocs(allDocsResult);
      } catch(e) {
        toast('info', 'Documents additionnels non disponibles');
      }

      // Generate PS1 (includes memory registers + optional docs)
      const slashCmds = recsWithContent
        .filter(r => r.res && (r.res.type === 'slash-command' || r.res.type === 'workflow') && r.res.path);
      const ps1 = buildPS1(project, md, slashCmds.map(r => r.res), allDocsResult);
      setPs1Content(ps1);

      toast('ok', 'Livrables générés');
      saveSession({ step: 3, claudeMd: md, ps1Content: ps1, allDocs: allDocsResult });
    } catch(e) {
      toast('err', 'Erreur génération: ' + e.message);
      setStep(2);
    } finally {
      setGenLoading(false);
    }
  };

  const goScaffold = () => {
    setStep(4);
    saveSession({ step: 4 });
    toast('ok', 'Scaffold prêt');
  };

  const goGuide = async () => {
    setStep(5);
    setGuide(null);
    setGenLoading(true);
    try {
      const g = await apiGenerateGuide(project, claudeMd, allDocs, conversationRef.current);
      setGuide(g);
      saveSession({ step: 5, guide: g });
      toast('ok', 'Guide de démarrage généré');
    } catch(e) {
      toast('err', 'Erreur génération guide: ' + e.message);
      setStep(4);
    } finally {
      setGenLoading(false);
    }
  };

  const doSaveProject = () => {
    if (!claudeMd || !ps1Content) { toast('err', 'Génère les livrables d\'abord'); return; }
    const item = {
      id: Date.now(),
      name: project.name || 'Projet sans nom',
      desc: project.desc,
      stack: project.stack,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      claudeMd, ps1Content, allDocs, guide, recs, resources, selected,
    };
    setLibB(l => [item, ...l]);
    toast('ok', `"${item.name}" sauvegardé dans la bibliothèque`);
    setRightTab('library');
  };

  const doRestoreProject = (p) => {
    setProject({ name: p.name, desc: p.desc || '', stack: p.stack || '', goals: '', domains: '' });
    setClaudeMd(p.claudeMd);
    setPs1Content(p.ps1Content);
    setAllDocs(p.allDocs || null);
    setGuide(p.guide || null);
    setRecs(p.recs || []);
    setResources(p.resources || []);
    setSelected(p.selected || []);
    setStep(4);
    setRightTab('pipeline');
    toast('info', `Projet "${p.name}" restauré`);
  };

  const resetProject = () => {
    setProject(EMPTY_PROJECT_B);
    setStep(0);
    setMessages([]);
    setRecs([]);
    setResources([]);
    setSelected([]);
    setClaudeMd(null);
    setPs1Content(null);
    setAllDocs(null);
    setGuide(null);
    conversationRef.current = [];
    localStorage.removeItem('pp_session_b');
  };

  return (
    <div className="cols">
      {/* LEFT — project form */}
      <div className="col left">
        <SectionTabs tabs={[{ id: 'proj', label: 'Projet' }]} active="proj" onSelect={() => {}} />
        <DictateBar showRestructure={false} />
        <div className="panelbody scroll">
          <div className="stack">
            <Field num="01" label="Nom du projet">
              <Input value={project.name} onChange={v => setP('name', v)} placeholder="catalogue-api" mono />
            </Field>
            <Field num="02" label="Description">
              <Textarea value={project.desc} onChange={v => setP('desc', v)} rows={3}
                placeholder="API REST pour gérer un catalogue produits avec authentification JWT…" />
            </Field>
            <Field num="03" label="Stack technique" opt>
              <Textarea value={project.stack} onChange={v => setP('stack', v)} rows={2}
                placeholder="Node.js 20 · Express · PostgreSQL · Zod · Vitest" />
            </Field>
            <Field num="04" label="Objectifs" opt>
              <Textarea value={project.goals} onChange={v => setP('goals', v)} rows={2}
                placeholder="Réponses < 200ms p95, couverture tests > 80%…" />
            </Field>
            <Field num="05" label="Domaines métier" opt>
              <Input value={project.domains || ''} onChange={v => setP('domains', v)}
                placeholder="vente, RH, facturation, analytics…" />
            </Field>
            <button className="btn btn-primary lg" onClick={analyze} disabled={genLoading}>
              <Icon name="sparkle" size={18} /> Analyser &amp; Recommander
            </button>
            {step > 0 && (
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={resetProject}>
                ↺ Nouveau projet
              </button>
            )}
            <div className="divider" />
            <div style={{ fontSize: 12, color: 'var(--mut-2)', lineHeight: 1.6 }}>
              Le pipeline génère un <b style={{ color: 'var(--mut)' }}>CLAUDE.md</b>, un script{' '}
              <b style={{ color: 'var(--mut)' }}>PowerShell</b> de setup, et le{' '}
              <b style={{ color: 'var(--mut)' }}>scaffold</b> du projet.
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — tabs: Pipeline | Bibliothèque | Guide */}
      <div className="col">
        <SectionTabs
          tabs={[
            { id: 'pipeline',  label: 'Pipeline' },
            { id: 'library',   label: 'Bibliothèque' },
            { id: 'guide',     label: 'Guide' },
          ]}
          active={rightTab} onSelect={setRightTab}
          counts={{ library: libB.length }} />

        {rightTab === 'pipeline' && (
          <>
            <Stepper step={step} onGoTo={n => {
              if (n === 1 && messages.length > 0) setStep(1);
              else if (n === 2 && recs.length > 0) setStep(2);
              else if (n === 3 && claudeMd) setStep(3);
              else if (n === 4 && ps1Content) setStep(4);
              else if (n === 5 && guide) setStep(5);
            }} />
            {step === 0 && (
              <div className="panelbody scroll">
                <EmptyState icon="layers" title="Pipeline en attente"
                  sub="Renseigne ton projet à gauche puis lance « Analyser & Recommander » pour démarrer le brainstorm." />
              </div>
            )}
            {step === 1 && (
              <ChatStep messages={messages} input={chatInput} setInput={setChatInput}
                onSend={sendChat} loading={chatLoading}
                nextLabel="Générer les recommandations"
                onNext={goRecommend}
                onViewRecs={recs.length > 0 ? () => setStep(2) : null} />
            )}
            {step === 2 && (
              genLoading
                ? <div className="panelbody scroll"><Spinner label="Claude analyse les ressources disponibles…" /></div>
                : <RecoStep recs={recs} resources={resources} selected={selected} toggle={toggle}
                    nextLabel={claudeMd ? 'Voir les livrables' : 'Générer les livrables'}
                    onNext={() => claudeMd ? setStep(3) : goLivrables()}
                    onBack={() => setStep(1)} />
            )}
            {step === 3 && (
              genLoading
                ? <div className="panelbody scroll"><Spinner label="Génération des documents avec Claude…" /></div>
                : <DeliverablesStep project={project} claudeMd={claudeMd} ps1Content={ps1Content}
                    allDocs={allDocs} selectedRecs={selected} resources={resources} toast={toast}
                    onNext={goScaffold} onBack={() => setStep(2)} onRegenerate={goLivrables} />
            )}
            {step === 4 && (
              <ScaffoldStep project={project} ps1Content={ps1Content} toast={toast}
                onBack={() => setStep(3)} onSave={doSaveProject}
                onNext={guide ? () => setStep(5) : goGuide}
                guideExists={!!guide} />
            )}
            {step === 5 && (
              genLoading
                ? <div className="panelbody scroll"><Spinner label="Génération du guide de démarrage…" /></div>
                : <GuideStep guide={guide} project={project} toast={toast}
                    onBack={() => setStep(4)} onSave={doSaveProject} onRegenerate={goGuide} />
            )}
          </>
        )}

        {rightTab === 'library' && (
          <LibraryBPane libB={libB} search={search}
            onRestore={doRestoreProject}
            onDelete={p => { setLibB(l => l.filter(x => x.id !== p.id)); toast('info', 'Projet supprimé'); }} />
        )}

        {rightTab === 'guide' && <GuideBPane />}
      </div>
    </div>
  );
}

window.ModeB = ModeB;
