// ============================================================
// app.jsx — App shell: topbar, mode switch, hooks, theme, toasts
// ============================================================

function App() {
  const [mode, setMode]     = React.useState('A');
  const [toasts, toast]     = useToasts();
  const [theme, setTheme]   = React.useState(() => localStorage.getItem('pp-theme') || 'light');
  const [search, setSearch] = React.useState('');
  const searchRef = React.useRef(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pp-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const switchMode = (m) => { setMode(m); setSearch(''); };

  return (
    <div className="app">
      <div className="topbar">
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--mut-2)', border: '1px solid var(--brd)', borderRadius: 8, padding: '5px 12px', textDecoration: 'none', transition: 'all .15s', fontFamily: 'var(--f-sans)', marginRight: 4, flexShrink: 0 }}
          onMouseOver={e => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--mut)'; }}
          onMouseOut={e => { e.currentTarget.style.color = 'var(--mut-2)'; e.currentTarget.style.borderColor = 'var(--brd)'; }}>
          ← Studio
        </a>
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-name">Prompt Perfect</div>
            <div className="brand-sub">ATELIER DE PROMPTS</div>
          </div>
        </div>

        <div className="modeswitch">
          <button className={mode === 'A' ? 'active' : ''} onClick={() => switchMode('A')}>
            Prompts XML
          </button>
          <button className={mode === 'B' ? 'active' : ''} onClick={() => switchMode('B')}>
            Claude Code
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="searchbox" style={{ width: 220, height: 38 }}>
            <Icon name="search" size={15} style={{ color: 'var(--mut-2)', flexShrink: 0 }} />
            <input ref={searchRef} placeholder="Rechercher…" value={search}
              onChange={e => setSearch(e.target.value)} />
            {search
              ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mut)', padding: '0 2px', lineHeight: 1 }}
                  onClick={() => setSearch('')}><Icon name="x" size={13} /></button>
              : <span className="kbd">⌘K</span>}
          </div>
          <button className="iconbtn" title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
        </div>
      </div>

      {mode === 'A'
        ? <ModeA toast={toast} search={search} setSearch={setSearch} />
        : <ModeB toast={toast} search={search} />}

      <ToastHost toasts={toasts} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
