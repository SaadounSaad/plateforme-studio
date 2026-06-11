// ============================================================
// modeA.jsx — Générateur de prompts XML (Mode A)
// ============================================================

// ── Left: Construire ──────────────────────────────────────
function BuildForm({ form, set, onGenerate, loading }) {
  return (
    <div className="stack">
      <Field num="01" label="Rôle">
        <Input value={form.role} onChange={v => set('role', v)}
          placeholder="Ex: Tu es un expert RH spécialisé en droit social marocain…" />
      </Field>
      <Field num="02" label="Objectif">
        <Textarea value={form.goal} onChange={v => set('goal', v)} rows={3}
          placeholder="Décris ce que Claude doit faire. Instructions séquentielles si plusieurs étapes.&#10;Ex: 1. Lis le document. 2. Identifie. 3. Rédige." />
      </Field>
      <Field num="03" label="Contexte" opt>
        <Textarea value={form.ctx} onChange={v => set('ctx', v)} rows={2}
          placeholder="Pourquoi cette tâche, pour qui, dans quel cadre…" />
      </Field>
      <Field num="04" label="Exemples few-shot" rec>
        <div className="grid2">
          <div>
            <span className="minilabel">INPUT</span>
            <Textarea value={form.exInput} onChange={v => set('exInput', v)} rows={3} mono
              placeholder="Exemple de donnée d'entrée" />
          </div>
          <div>
            <span className="minilabel">OUTPUT</span>
            <Textarea value={form.exOutput} onChange={v => set('exOutput', v)} rows={3} mono
              placeholder="Sortie attendue correspondante" />
          </div>
        </div>
      </Field>
      <div className="grid3">
        <div><span className="minilabel">Style de sortie</span>
          <Select value={form.style} onChange={v => set('style', v)} options={STYLE_OPTS} /></div>
        <div><span className="minilabel">Langue</span>
          <Select value={form.lang} onChange={v => set('lang', v)} options={LANG_OPTS} /></div>
        <div><span className="minilabel">Variable input</span>
          <Input value={form.varName} onChange={v => set('varName', v)} mono placeholder="ex: DOCUMENT" /></div>
      </div>
      <Field num="05" label="Contraintes supplémentaires" opt>
        <Input value={form.fmtExtra} onChange={v => set('fmtExtra', v)}
          placeholder="Max 15 mots, éviter le jargon, ton formel…" />
      </Field>
      <Field num="06" label="Notes libres" opt>
        <Input value={form.notes} onChange={v => set('notes', v)}
          placeholder="Mémo interne, non envoyé au modèle…" />
      </Field>
      <button className="btn btn-primary lg" onClick={onGenerate} disabled={loading}>
        {loading
          ? <><div className="spin-sm" style={{ borderTopColor: 'var(--on-accent)' }} /> Génération…</>
          : <><Icon name="sparkle" size={18} /> Générer le prompt XML</>}
      </button>
    </div>
  );
}

// ── Right: Résultats ──────────────────────────────────────
function ResultsPane({ result, saveName, saveCat, setSaveName, setSaveCat, onCopy, onSave }) {
  if (!result) return (
    <EmptyState icon="sparkle" title="Aucun résultat pour l'instant"
      sub="Remplis le formulaire Construire (ou dicte une consigne) puis génère ton prompt XML." />
  );
  const tokens = Math.max(1, Math.round(result.length / 3.6));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dot"></span> prompt.xml · ~{tokens} tokens
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onCopy}>
          <Icon name="copy" size={14} /> Copier
        </button>
      </div>
      <div className="codewrap">
        <div className="codebar">
          <span className="meta"><Icon name="terminal" size={13} /> sortie générée</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mut-2)' }}>XML · Anthropic</span>
        </div>
        <pre className="code scroll" style={{ maxHeight: 320 }}>
          <XMLView src={result} />
        </pre>
      </div>
      <div className="guide-block" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="save" size={14} style={{ color: 'var(--accent)' }} /> Sauvegarder dans la bibliothèque
        </div>
        <div className="grid2">
          <Input value={saveName} onChange={setSaveName} placeholder="Nom du prompt" />
          <Select value={saveCat} onChange={setSaveCat} options={CAT_OPTS} />
        </div>
        <button className="btn btn-soft" style={{ alignSelf: 'flex-start' }} onClick={onSave}>
          <Icon name="plus" size={15} /> Ajouter à la bibliothèque
        </button>
      </div>
    </div>
  );
}

// ── Right: Bibliothèque ───────────────────────────────────
function LibraryPane({ lib, search, setSearch, langFilter, setLangFilter,
                       editId, setEditId, onRestore, onCopy, onDelete, onSaveEdit, onImport, toast }) {
  const [draft, setDraft] = React.useState(null);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    if (editId) {
      const it = lib.find(x => x.id === editId);
      if (it) {
        const cleanXml = (it.xml || '').replace(/^```(?:\w+)?\s*/,'').replace(/\s*```$/,'').trim();
        setDraft({ ...it, xml: cleanXml });
      } else {
        setDraft(null);
      }
    } else {
      setDraft(null);
    }
  }, [editId]);

  const LANGS = ['ALL', 'fr', 'ar', 'en'];
  const LANG_LABELS = { ALL: 'Tous', fr: 'FR', ar: 'AR', en: 'EN' };

  const filtered = lib.filter(p =>
    (langFilter === 'ALL' || p.lang === langFilter) &&
    (!search || (p.title + p.xml + (p.cat || '')).toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    downloadText(JSON.stringify(lib, null, 2), 'pp-lib.json');
    toast('ok', `${lib.length} prompt${lib.length > 1 ? 's' : ''} exporté${lib.length > 1 ? 's' : ''}`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const items = JSON.parse(ev.target.result);
        if (!Array.isArray(items)) { toast('err', 'Format JSON invalide'); return; }
        const merge = window.confirm(
          `${items.length} prompt${items.length > 1 ? 's' : ''} trouvé${items.length > 1 ? 's' : ''}.\n\n` +
          `OK → Fusionner avec la bibliothèque actuelle\nAnnuler → Remplacer tout`
        );
        onImport(items, merge);
        toast('ok', `${items.length} prompts importés`);
      } catch(err) {
        toast('err', 'Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="searchrow">
        <div className="searchbox">
          <Icon name="search" size={15} style={{ color: 'var(--mut-2)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un prompt…" />
          {search && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mut)', padding: '0 2px', lineHeight: 1 }}
              onClick={() => setSearch('')}><Icon name="x" size={12} /></button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {LANGS.map(l => (
            <button key={l} className={`hook${langFilter === l ? ' on' : ''}`}
              style={{ padding: '7px 11px' }} onClick={() => setLangFilter(l)}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={handleExport} style={{ flex: 1 }}>
          <Icon name="download" size={13} /> Exporter JSON
        </button>
        <label className="btn btn-ghost btn-sm" style={{ flex: 1, cursor: 'pointer' }}>
          <Icon name="restore" size={13} /> Importer JSON
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={handleFileChange} />
        </label>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon="book" title={lib.length ? 'Aucun résultat' : 'Bibliothèque vide'}
          sub={lib.length ? 'Essaie un autre filtre.' : 'Tes prompts sauvegardés apparaîtront ici. Génère puis enregistre depuis l\'onglet Résultats.'} />
      )}

      {filtered.map(p => {
        // Strip markdown code fences saved by older versions
        const cleanXml = (p.xml || '').replace(/^```(?:\w+)?\s*/,'').replace(/\s*```$/,'').trim();
        const pClean = cleanXml !== p.xml ? { ...p, xml: cleanXml } : p;
        return (
        <div key={p.id} className="lib-card">
          {editId === p.id && draft ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="grid2">
                <Input value={draft.title} onChange={v => setDraft({ ...draft, title: v })} placeholder="Titre" />
                <Select value={draft.cat || ''} onChange={v => setDraft({ ...draft, cat: v })} options={CAT_OPTS} />
              </div>
              <Textarea value={draft.xml} onChange={v => setDraft({ ...draft, xml: v })} rows={6} mono />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onSaveEdit(draft)}>
                  <Icon name="check" size={14} /> Enregistrer
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <div className="lib-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span className="lib-title">{pClean.title}</span>
                    {pClean.cat && <span className="lib-cat">{pClean.cat}</span>}
                  </div>
                </div>
                <div className="lib-actions">
                  <button className="act" title="Restaurer dans le formulaire" onClick={() => onRestore(pClean)}>
                    <Icon name="restore" size={14} />
                  </button>
                  <button className="act" title="Copier" onClick={() => onCopy(pClean)}>
                    <Icon name="copy" size={14} />
                  </button>
                  <button className="act" title="Modifier" onClick={() => setEditId(pClean.id)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button className="act danger" title="Supprimer" onClick={() => onDelete(pClean)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              <pre className="lib-snippet" style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{pClean.xml}</pre>
              <div className="lib-meta">
                <span className="langpill">{(pClean.lang || 'fr').toUpperCase()}</span>
                <span>{pClean.date}</span>
              </div>
            </>
          )}
        </div>
        );
      })}
    </div>
  );
}

// ── Right: Guide ──────────────────────────────────────────
function GuidePane() {
  return (
    <div className="stack guide" style={{ gap: 18 }}>
      <div>
        <h3>Bonnes pratiques Anthropic</h3>
        <p className="lead">Un bon prompt donne un <b>rôle</b>, un <b>objectif</b> clair, du <b>contexte</b>, des <b>exemples</b>, et structure le tout en <b>balises XML</b> pour lever toute ambiguïté.</p>
      </div>
      <div className="guide-block">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="layers" size={15} style={{ color: 'var(--accent)' }} /> Anatomie d'un prompt XML
        </div>
        <pre className="code" style={{ padding: 0, fontSize: 11.5 }}>
          <XMLView src={'<prompt>\n  <role>Tu es un expert en…</role>\n  <instructions>\n    1. Lis le document.\n    2. Identifie les points clés.\n    3. Rédige un résumé.\n  </instructions>\n  <context>Pour un public non-technique</context>\n  <examples>\n    <example index="1">\n      <input>{{DOCUMENT}}</input>\n      <output>…</output>\n    </example>\n  </examples>\n  <output_format>Style: Liste numérotée. Langue: Français soutenu.</output_format>\n  <input>{{DOCUMENT}}</input>\n</prompt>'} />
        </pre>
      </div>
      <div className="guide-block">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="zap" size={15} style={{ color: 'var(--accent)' }} /> Workflow recommandé · 7 étapes
        </div>
        {GUIDE_WORKFLOW.map((s, i) => (
          <div className="workflow-step" key={i}>
            <div className="ws-num">{i + 1}</div>
            <div><div className="ws-title">{s[0]}</div><div className="ws-desc">{s[1]}</div></div>
          </div>
        ))}
      </div>
      <div className="guide-block">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="command" size={15} style={{ color: 'var(--accent)' }} /> Skills disponibles
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GUIDE_SKILLS.map(s => (
            <span key={s} className="skill-chip">
              <Icon name="sparkle" size={12} style={{ color: 'var(--accent)' }} /> {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ModeA container ───────────────────────────────────────
function ModeA({ toast, search, setSearch }) {
  const [rightTab, setRightTab] = React.useState('results');
  const [form, setForm]         = React.useState(EMPTY_FORM);
  const [result, setResult]     = React.useState(null);
  const [loading, setLoading]   = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  const [saveCat, setSaveCat]   = React.useState('');
  const [langFilter, setLangFilter] = React.useState('ALL');

  // Auto-switch to library when user searches from topbar
  React.useEffect(() => {
    if (search) setRightTab('library');
  }, [search]);
  const [editId, setEditId]     = React.useState(null);

  const [lib, setLib] = React.useState(() => {
    try {
      const s = localStorage.getItem('pp-lib');
      const raw = s ? JSON.parse(s) : SEED_LIBRARY;
      // Strip markdown code fences saved by older versions
      return raw.map(p => {
        const clean = (p.xml || '').replace(/^```(?:\w+)?\s*/,'').replace(/\s*```$/,'').trim();
        return clean !== p.xml ? { ...p, xml: clean } : p;
      });
    } catch (e) { return SEED_LIBRARY; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('pp-lib', JSON.stringify(lib)); } catch(e) {}
  }, [lib]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    if (!form.role.trim() || !form.goal.trim()) {
      toast('err', 'Rôle et Objectif sont obligatoires');
      return;
    }
    const structured = buildXML(form);
    setLoading(true);
    setRightTab('results');
    try {
      const refined = await apiRefinePrompt(structured);
      setResult(refined || structured);
      toast('ok', 'Prompt XML généré');
    } catch (e) {
      setResult(structured);
      toast('info', 'Mode hors-ligne — prompt généré localement');
    } finally {
      setLoading(false);
    }
  };

  const restructure = async (raw) => {
    if (!raw || !raw.trim()) return;
    setLoading(true);
    setRightTab('results');
    try {
      const xml = await apiRestructure(raw, form.lang);
      setResult(xml);
      toast('ok', 'Consigne restructurée en XML');
    } catch (e) {
      const fallback = buildXML({ role: 'Assistant rédactionnel', goal: raw.trim(), style: 'prose', lang: form.lang, varName: '', fmtExtra: '', ctx: '', exInput: '', exOutput: '', notes: '' });
      setResult(fallback);
      toast('info', 'Mode hors-ligne — restructuration locale');
    } finally {
      setLoading(false);
    }
  };

  const doSave = () => {
    if (!result) return;
    const rawName = saveName.trim();
    if (!rawName) { toast('err', 'Donne un nom au prompt'); return; }

    // Versioning: detect duplicate name and suggest next version
    const exact = lib.find(p => p.title.toLowerCase() === rawName.toLowerCase());
    if (exact) {
      // Find highest V# already used for this base name
      const base = rawName.replace(/\s+V\d+$/i, '').trim();
      const existing = lib.filter(p => p.title.toLowerCase().startsWith(base.toLowerCase()));
      let maxV = 1;
      existing.forEach(p => {
        const m = p.title.match(/V(\d+)$/i);
        if (m) maxV = Math.max(maxV, parseInt(m[1], 10));
      });
      const suggested = `${base} V${maxV + 1}`;
      const confirmed = window.confirm(
        `Un prompt nommé "${rawName}" existe déjà.\n\nSauvegarder comme "${suggested}" ?`
      );
      if (!confirmed) return;
      setSaveName(suggested);
      // Re-use suggested name directly
      const langMap = { fr: 'fr', ar: 'ar', en: 'en', same: 'fr' };
      const item = {
        id: Date.now(), title: suggested, cat: saveCat,
        lang: langMap[form.lang] || 'fr', xml: result,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        fields: { ...form }
      };
      setLib(l => [item, ...l]);
      setSaveName(''); setSaveCat('');
      toast('ok', `Sauvegardé comme "${suggested}"`);
      setRightTab('library');
      return;
    }

    const langMap = { fr: 'fr', ar: 'ar', en: 'en', same: 'fr' };
    const item = {
      id: Date.now(), title: rawName, cat: saveCat,
      lang: langMap[form.lang] || 'fr', xml: result,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      fields: { ...form }
    };
    setLib(l => [item, ...l]);
    setSaveName(''); setSaveCat('');
    toast('ok', 'Ajouté à la bibliothèque');
    setRightTab('library');
  };

  const doRestore = (p) => {
    const cleanXml = (p.xml || '').replace(/^```(?:\w+)?\s*/,'').replace(/\s*```$/,'').trim();
    if (p.fields) {
      setForm({ ...EMPTY_FORM, ...p.fields });
    } else {
      const get = (tag) => {
        const m = cleanXml.match(new RegExp('<' + tag + '>[\\s\\S]*?<\\/' + tag + '>'));
        return m ? m[0].replace(/<[^>]+>/g, '').trim() : '';
      };
      setForm({ ...EMPTY_FORM, role: get('role'), goal: get('instructions'), ctx: get('context') });
    }
    setResult(cleanXml);
    setRightTab('results');
    toast('info', 'Prompt restauré');
  };

  return (
    <div className="cols">
      {/* LEFT */}
      <div className="col left">
        <SectionTabs tabs={[{ id: 'build', label: 'Construire' }]} active="build" onSelect={() => {}} />
        <DictateBar onRestructure={restructure} loadingRestructure={loading} showRestructure={true} />
        <div className="panelbody scroll">
          <BuildForm form={form} set={setField} onGenerate={generate} loading={loading} />
        </div>
      </div>
      {/* RIGHT */}
      <div className="col">
        <SectionTabs
          tabs={[
            { id: 'results', label: 'Résultats' },
            { id: 'library', label: 'Bibliothèque' },
            { id: 'guide', label: 'Guide' },
          ]}
          active={rightTab} onSelect={setRightTab}
          counts={{ library: lib.length }} />
        <div className="panelbody scroll">
          {rightTab === 'results' && (
            <ResultsPane result={result} saveName={saveName} saveCat={saveCat}
              setSaveName={setSaveName} setSaveCat={setSaveCat}
              onCopy={() => copyText(result, toast)}
              onSave={doSave} />
          )}
          {rightTab === 'library' && (
            <LibraryPane lib={lib} search={search} setSearch={setSearch}
              langFilter={langFilter} setLangFilter={setLangFilter}
              editId={editId} setEditId={setEditId}
              onRestore={doRestore}
              onCopy={p => copyText(p.xml, toast)}
              onDelete={p => { setLib(l => l.filter(x => x.id !== p.id)); toast('info', 'Prompt supprimé'); }}
              onSaveEdit={d => { setLib(l => l.map(x => x.id === d.id ? d : x)); setEditId(null); toast('ok', 'Modifications enregistrées'); }}
              onImport={(items, merge) => {
                if (merge) setLib(l => [...l, ...items.filter(i => !l.find(e => e.id === i.id))]);
                else setLib(items);
              }}
              toast={toast} />
          )}
          {rightTab === 'guide' && <GuidePane />}
        </div>
      </div>
    </div>
  );
}

window.ModeA = ModeA;
