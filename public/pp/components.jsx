// ============================================================
// components.jsx — Shared UI primitives
// ============================================================
const { useState, useEffect, useRef, useCallback } = React;

// ── Icons (Lucide-style inline SVG) ──────────────────────
const ICONS = {
  search:    'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 005 19.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H1a2 2 0 110-4h.1A1.6 1.6 0 002.7 8l-.1-.1A2 2 0 115.4 5l.1.1a1.6 1.6 0 001.8.3H7.4A1.6 1.6 0 008.5 4V3.9a2 2 0 114 0V4a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8v.1a1.6 1.6 0 001.5 1h.2a2 2 0 110 4h-.2a1.6 1.6 0 00-1.5 1z',
  copy:      'M9 9h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2zM5 15H4a2 2 0 01-2-2V3a2 2 0 012-2h10a2 2 0 012 2v1',
  save:      'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  plus:      'M12 5v14M5 12h14',
  restore:   'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15',
  edit:      'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z',
  trash:     'M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2',
  mic:       'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
  check:     'M20 6L9 17l-5-5',
  arrowRight:'M5 12h14M12 5l7 7-7 7',
  send:      'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  sparkle:   'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17l-1.9-5.1L4.5 10l5.6-1.4L12 3z',
  x:         'M18 6L6 18M6 6l12 12',
  info:      'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  file:      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  folder:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  terminal:  'M4 17l6-6-6-6M12 19h8',
  book:      'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5z',
  layers:    'M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  command:   'M18 3a3 3 0 00-3 3v12a3 3 0 103-3H6a3 3 0 103 3V6a3 3 0 10-3 3h12a3 3 0 003-3z',
  zap:       'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  wave:      'M2 12h2l2-6 3 14 3-18 3 14 2-4h3',
  sun:       'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon:      'M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z',
  download:  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  chevronDown: 'M6 9l6 6 6-6',
  eye:       'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
};

function Icon({ name, size = 16, sw = 2, style }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

// ── Form primitives ───────────────────────────────────────
function Field({ num, label, opt, rec, children }) {
  return (
    <div className="field">
      <div className="field-label">
        {num && <span className="field-num">{num}</span>}
        <span className="field-name">{label}</span>
        {opt && <span className="badge-opt">optionnel</span>}
        {rec && <span className="badge-rec">RECOMMANDÉ</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ id, value, onChange, placeholder, mono, disabled }) {
  return (
    <input
      id={id}
      className={`input${value ? ' filled' : ''}${mono ? ' mono' : ''}`}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function Textarea({ id, value, onChange, onKeyDown, placeholder, rows = 3, mono, disabled }) {
  return (
    <textarea
      id={id}
      className={`textarea${value ? ' filled' : ''}${mono ? ' mono' : ''}`}
      value={value}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

function Select({ value, onChange, options, disabled }) {
  return (
    <select className="select" value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function SectionTabs({ tabs, active, onSelect, counts }) {
  return (
    <div className="panelhead">
      <div className="tabrow">
        {tabs.map(t => (
          <button key={t.id} className={`tab${active === t.id ? ' active' : ''}`} onClick={() => onSelect(t.id)}>
            {t.label}
            {counts && counts[t.id] != null && counts[t.id] > 0 &&
              <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="empty">
      <div className="ei"><Icon name={icon} size={24} /></div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mut)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, maxWidth: 280, lineHeight: 1.6 }}>{sub}</div>}
    </div>
  );
}

// ── Code block wrapper ────────────────────────────────────
function CodeBlock({ label, lang, children, onCopy, maxHeight = 300 }) {
  return (
    <div className="codewrap">
      <div className="codebar">
        <span className="meta"><Icon name="terminal" size={13} /> {label}</span>
        {lang && <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mut-2)' }}>{lang}</span>}
        {onCopy && (
          <button className="btn btn-ghost btn-sm" onClick={onCopy}>
            <Icon name="copy" size={13} /> Copier
          </button>
        )}
      </div>
      <pre className="code scroll" style={{ maxHeight }}>{children}</pre>
    </div>
  );
}

// ── Deliverable block ─────────────────────────────────────
function Deliverable({ icon, name, onCopy, onDownload, children }) {
  return (
    <div className="deliv">
      <div className="deliv-head">
        <span className="deliv-name"><Icon name={icon} size={14} style={{ color: 'var(--accent)' }} /> {name}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {onDownload && (
            <button className="btn btn-ghost btn-sm" onClick={onDownload}>
              <Icon name="download" size={13} /> Télécharger
            </button>
          )}
          {onCopy && (
            <button className="btn btn-ghost btn-sm" onClick={onCopy}>
              <Icon name="copy" size={13} /> Copier
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Toast system ──────────────────────────────────────────
function ToastHost({ toasts }) {
  const tic = { ok: 'check', err: 'x', info: 'info' };
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="tic"><Icon name={tic[t.type]} size={14} sw={2.5} /></span>
          <span className="tmsg">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((type, msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);
  return [toasts, toast];
}

// ── DictateBar ────────────────────────────────────────────
const SPEECH_LANGS = [
  { v: 'fr-FR', l: 'Français' },
  { v: 'ar-MA', l: 'Darija / عربية' },
  { v: 'ar-SA', l: 'Arabe classique' },
  { v: 'en-US', l: 'English' },
];

function DictateBar({ onRestructure, loadingRestructure, showRestructure }) {
  const [recording, setRecording] = useState(false);
  const [lang, setLang] = useState('fr-FR');
  const [raw, setRaw] = useState('');
  const recognitionRef = useRef(null);
  const rawRef = useRef('');

  const toggleRec = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Dictée vocale non supportée. Utilise Chrome.'); return; }
    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = e => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex).map(x => x[0].transcript).join(' ');
      rawRef.current += ' ' + transcript;
      setRaw(rawRef.current);
      // Fill currently focused field via native setter (works with React controlled inputs)
      const el = document.activeElement;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, (el.value || '') + ' ' + transcript);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    recognitionRef.current = r;
    rawRef.current = raw;
    r.start();
    setRecording(true);
  };

  return (
    <div className="dictate-bar">
      <button className={`mic-sm${recording ? ' rec' : ''}`} onClick={toggleRec} title={recording ? 'Arrêter' : 'Dicter'}>
        <Icon name="mic" size={16} />
      </button>
      <select className="select"
        value={lang} onChange={e => setLang(e.target.value)}>
        {SPEECH_LANGS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <span className="dictate-hint">
        {recording ? '● À l\'écoute…' : 'Focalisez un champ puis dictez'}
      </span>
      {showRestructure && raw.trim() && (
        <button className="btn btn-soft btn-sm" style={{ marginLeft: 'auto' }}
          onClick={() => onRestructure && onRestructure(raw)}
          disabled={loadingRestructure}>
          <Icon name="sparkle" size={13} /> Restructurer → XML
        </button>
      )}
    </div>
  );
}

// ── Markdown helpers ──────────────────────────────────────
function applyInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))   return <code key={i} className="md-code">{p.slice(1,-1)}</code>;
    return p;
  });
}

function renderMarkdown(text) {
  if (!text) return null;
  return (
    <div className="md-body">
      {text.split('\n').map((line, i) => {
        if (!line.trim())                   return <div key={i} className="md-gap" />;
        if (line.startsWith('## '))         return <div key={i} className="md-h2">{line.slice(3)}</div>;
        if (line.startsWith('# '))          return <div key={i} className="md-h1">{line.slice(2)}</div>;
        if (/^[a-d]\)/.test(line.trim()))   return <div key={i} className="md-option">{applyInline(line)}</div>;
        if (/^[-*] /.test(line.trim()))     return <div key={i} className="md-bullet">{applyInline(line.replace(/^[-*] /,''))}</div>;
        return <div key={i} className="md-line">{applyInline(line)}</div>;
      })}
    </div>
  );
}

// ── Accordion ─────────────────────────────────────────────
function Accordion({ title, icon, badge, actions, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`accord${open ? ' open' : ''}`}>
      <div className="accord-head" onClick={() => setOpen(o => !o)}>
        <span className="accord-title">
          {icon && <Icon name={icon} size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
          {title}
        </span>
        {badge && <span className="accord-badge">{badge}</span>}
        <div className="accord-actions" onClick={e => e.stopPropagation()}>{actions}</div>
        <Icon name="chevronDown" size={14} style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--mut-2)', flexShrink: 0 }} />
      </div>
      {open && <div className="accord-body">{children}</div>}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────
function Spinner({ label }) {
  return (
    <div className="loading-row">
      <div className="spin-sm" />
      {label && <span style={{ fontSize: 12.5, color: 'var(--mut)' }}>{label}</span>}
    </div>
  );
}

// ── Copy helper ───────────────────────────────────────────
function copyText(str, toast, label = 'Copié dans le presse-papier') {
  try {
    navigator.clipboard.writeText(str);
    if (toast) toast('ok', label);
  } catch (e) {
    if (toast) toast('err', 'Copie impossible');
  }
}

// ── Download helper ───────────────────────────────────────
function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

Object.assign(window, {
  Icon, ICONS,
  Field, Input, Textarea, Select,
  SectionTabs, EmptyState, CodeBlock, Deliverable,
  ToastHost, useToasts,
  Spinner, copyText, downloadText,
  DictateBar, SPEECH_LANGS,
  applyInline, renderMarkdown, Accordion,
});
