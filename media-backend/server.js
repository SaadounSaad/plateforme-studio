const express  = require('express');
const cors     = require('cors');
const { spawn, execSync, spawnSync } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const archiver = require('archiver');
const https    = require('https');
const http     = require('http');
const dns      = require('dns').promises;
const net      = require('net');
const multer   = require('multer');

const app  = express();
const PORT = process.env.PORT || 7880;

const ALLOWED_ORIGINS = new Set([
  'http://localhost:7880',
  'http://localhost:3000',
  'https://plateforme-studio.vercel.app',
]);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin header) and known origins only
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(Object.assign(new Error('Origin non autorisée'), { status: 403 }));
  },
  credentials: false,
}));

// CSRF guard: mutating endpoints require this header.
// A cross-origin page cannot set custom headers without a CORS preflight,
// which will be blocked above — so this is defense-in-depth.
function requireLocalHeader(req, res, next) {
  if (req.headers['x-local-request'] !== '1') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/media-backend', express.static(__dirname));

// ── binary detection (memoized — run once, cached for process lifetime) ────────
// Detection re-spawned on every /health call caused flaky ✗ badges under load
// (spawnSync timeouts). Cache results so detection runs once at startup.

function tryBin(bin) {
  try {
    const r = spawnSync(bin, ['--version'], { stdio: 'pipe', timeout: 10000 });
    return r.status === 0;
  } catch { return false; }
}

let _ytDlpBin, _pythonBin, _whisper, _ffmpeg;

function getYtDlpBin() {
  if (_ytDlpBin !== undefined) return _ytDlpBin;
  const candidates = [
    'yt-dlp',
    'yt-dlp.exe',
    path.join(os.homedir(), '.local/bin/yt-dlp'),
    path.join(os.homedir(), 'AppData/Local/Programs/Python/Python314/Scripts/yt-dlp.exe'),
    path.join(os.homedir(), 'AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe'),
    path.join(os.homedir(), 'AppData/Local/Programs/Python/Python312/Scripts/yt-dlp.exe'),
    path.join(os.homedir(), 'AppData/Local/Programs/Python/Python311/Scripts/yt-dlp.exe'),
    path.join(os.homedir(), 'AppData/Local/Programs/Python/Python310/Scripts/yt-dlp.exe'),
  ];
  _ytDlpBin = candidates.find(tryBin) || null;
  return _ytDlpBin;
}
function getPythonBin() {
  if (_pythonBin !== undefined) return _pythonBin;
  _pythonBin = ['python', 'python3', 'py'].find(tryBin) || null;
  return _pythonBin;
}
function hasWhisper() {
  if (_whisper !== undefined) return _whisper;
  const py = getPythonBin();
  if (!py) { _whisper = false; return _whisper; }
  try {
    const r = spawnSync(py, ['-c', 'import whisper'], { stdio: 'pipe', timeout: 20000 });
    _whisper = r.status === 0;
  } catch { _whisper = false; }
  return _whisper;
}
function hasFfmpeg() {
  if (_ffmpeg !== undefined) return _ffmpeg;
  const candidates = [
    'ffmpeg',
    'ffmpeg.exe',
    path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe'),
    'C:/Users/hp/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe',
  ];
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ['-version'], { stdio: 'pipe', timeout: 10000, shell: true });
      if (r.status === 0 || (r.stdout && r.stdout.toString().includes('ffmpeg'))) { _ffmpeg = c; return _ffmpeg; }
    } catch {}
  }
  _ffmpeg = false;
  return _ffmpeg;
}

// ── health ───────────────────────────────────────────────────────────────────

function healthHandler(_req, res) {
  res.json({
    ok: true,
    ytdlp:   !!getYtDlpBin(),
    whisper: hasWhisper(),
    python:  !!getPythonBin(),
    ffmpeg:  hasFfmpeg()
  });
}
app.get('/health', healthHandler);
app.get('/media-api/health', healthHandler);

// ── API router (mounted on /api for Next.js proxy, and /media-api for direct access)
const apiRouter = express.Router();

app.use('/api', apiRouter);
app.use('/media-api', apiRouter);

// ── security: whisper input allowlists (templated into Python source) ─────────

const WHISPER_MODELS = new Set([
  'tiny', 'base', 'small', 'medium', 'large', 'large-v1', 'large-v2', 'large-v3',
  'tiny.en', 'base.en', 'small.en', 'medium.en',
]);
const WHISPER_LANGS = new Set([
  'auto', 'fr', 'ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko', 'tr',
]);
const TRANSLATE_LANGS = new Set([
  'none', 'fr', 'ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ru', 'zh-CN', 'ja', 'ko', 'tr',
]);

// Audio container/codec names allowed from the client — these end up in output
// filenames (path traversal guard) and ffmpeg/yt-dlp args.
const AUDIO_EXTS = new Set(['mp3', 'aac', 'opus', 'm4a', 'wav', 'flac', 'ogg']);

// ── security: URL validation ─────────────────────────────────────────────────

// yt-dlp arg-injection guard: only accept real http(s) URLs (a valid one can
// never start with '-', so it can't be smuggled in as a yt-dlp option).
function assertHttpUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL invalide'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL invalide');
  return u;
}

// SSRF guard: is this resolved IP loopback / private / link-local?
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
  const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped IPv6
  if (m) return isPrivateIp(m[1]);
  return false;
}

// SSRF guard for outbound fetches: http(s) only + every resolved address public.
// Returns the parsed URL plus ONE validated IP to pin the connection to — this
// defeats DNS rebinding (the request connects to the IP we checked, not a
// freshly re-resolved one that could now point at a private host).
async function assertPublicUrl(raw) {
  const u = assertHttpUrl(raw);
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost') throw new Error('cible interdite');
  let address;
  if (net.isIP(host)) {
    address = host;
  } else {
    const addrs = await dns.lookup(host, { all: true });
    for (const a of addrs) {
      if (isPrivateIp(a.address)) throw new Error('cible interdite');
    }
    address = addrs[0].address;
  }
  if (isPrivateIp(address)) throw new Error('cible interdite');
  return { url: u, address };
}

// Build http(s).get options that connect to a pinned IP while preserving the
// original Host header and TLS SNI (servername) so vhosts / certs still work.
function pinnedGetOpts(u, address, headers, timeout) {
  return {
    host: address,
    servername: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    headers: { Host: u.hostname, ...headers },
    timeout,
  };
}

// ── detect platform from URL ─────────────────────────────────────────────────

function hostMatches(host, domains) {
  return domains.some(d => host === d || host.endsWith('.' + d));
}

function detectPlatform(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return 'generic'; }
  if (hostMatches(host, ['youtube.com', 'youtu.be'])) return 'youtube';
  if (hostMatches(host, ['instagram.com']))           return 'instagram';
  if (hostMatches(host, ['twitter.com', 'x.com']))    return 'twitter';
  return 'generic';
}

// ── info ─────────────────────────────────────────────────────────────────────

apiRouter.post('/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });
  try { assertHttpUrl(url); } catch { return res.status(400).json({ error: 'URL invalide' }); }
  const bin = getYtDlpBin();
  if (!bin) return res.status(500).json({ error: 'yt-dlp manquant' });

  const proc = spawn(bin, ['--dump-json', '--no-playlist', '--no-warnings', '--', url]);
  let out = '', err = '';
  proc.stdout.on('data', d => out += d);
  proc.stderr.on('data', d => err += d);
  proc.on('close', code => {
    if (code !== 0) return res.status(400).json({ error: err.trim() || 'Erreur yt-dlp' });
    try {
      const info = JSON.parse(out);
      const platform = detectPlatform(url);
      const fmts = (info.formats || []);

      const videoFormats = fmts
        .filter(f => f.vcodec !== 'none' && f.height)
        .map(f => ({ id: f.format_id, label: `${f.height}p${f.fps > 30 ? ' ' + f.fps + 'fps' : ''} — ${f.ext.toUpperCase()}`, height: f.height }))
        .sort((a, b) => b.height - a.height)
        .filter((v, i, arr) => i === arr.findIndex(x => x.height === v.height));

      // capabilities: what can we actually extract
      const caps = { video: true, audio: true, image: true };
      // text: youtube has subtitles or whisper; instagram has description; twitter has tweet text
      caps.text = platform === 'youtube' || platform === 'instagram' || platform === 'twitter';

      res.json({
        title:    info.title,
        thumbnail: info.thumbnail,
        duration:  info.duration,
        channel:   info.uploader || info.channel,
        platform,
        videoFormats,
        caps
      });
    } catch { res.status(500).json({ error: 'Parse error' }); }
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

function fetchInstagramImage(url) {
  return assertPublicUrl(url).then(({ url: u, address }) => new Promise((resolve) => {
    const protocol = u.protocol === 'https:' ? https : http;
    const timeout = setTimeout(() => resolve(null), 10000);
    const reqOpts = pinnedGetOpts(u, address, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, 10000);
    protocol.get(reqOpts, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        let imgUrl = null;

        // Try to extract from Instagram's embedded JSON (displayResources)
        const jsonMatch = html.match(/"displayResources":\[{[^}]*"src":"([^"]+)"/);
        if (jsonMatch && jsonMatch[1]) {
          imgUrl = jsonMatch[1];
        }

        // Fallback to og:image
        if (!imgUrl) {
          const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
          if (ogMatch) imgUrl = ogMatch[1];
        }

        // Decode HTML entities in URL
        if (imgUrl) {
          imgUrl = imgUrl.replace(/&amp;/g, '&');
          // Remove stp param which forces Instagram to resize to 640x640
          imgUrl = imgUrl.replace(/[?&]stp=[^&]+/, (m) => m.startsWith('?') ? '?' : '');
          imgUrl = imgUrl.replace(/\?&/, '?').replace(/[?&]$/, '');
        }
        resolve(imgUrl);
      });
    }).on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  })).catch(() => null);
}

function downloadFileToPath(imageUrl, filePath, referer) {
  return assertPublicUrl(imageUrl).then(({ url: u, address }) => new Promise((resolve, reject) => {
    const protocol = u.protocol === 'https:' ? https : http;
    const opts = pinnedGetOpts(u, address, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer || 'https://www.instagram.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }, 15000);

    const req = protocol.get(opts, (res) => {
      // Follow redirects manually (recursion re-validates the new target)
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          const next = new URL(redirectUrl, u).href;
          return downloadFileToPath(next, filePath, referer).then(resolve).catch(reject);
        }
      }

      // Check status
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }

      const file = fs.createWriteStream(filePath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Download timeout'));
    });
  }));
}

function buildContentDisposition(filename) {
  const ascii   = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function getBestFile(dir) {
  const files = fs.readdirSync(dir)
    .filter(f => !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.endsWith('.json'))
    .map(f => ({ name: f, size: fs.statSync(path.join(dir, f)).size }))
    .sort((a, b) => b.size - a.size);
  return files.length ? files[0].name : null;
}

function runSpawn(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let out = '', err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('close', code => code === 0 ? resolve(out) : reject(new Error(err.trim() || 'Process failed')));
  });
}

async function getVideoTitle(url, bin) {
  try {
    const out = await runSpawn(bin, ['--print', 'title', '--no-playlist', '--no-warnings', '--', url]);
    return out.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150) || 'untitled';
  } catch {
    return 'untitled';
  }
}

// ── single-item download ──────────────────────────────────────────────────────
// type: 'video' | 'audio' | 'image' | 'text'

async function downloadItem(url, type, opts = {}) {
  assertHttpUrl(url);
  const bin = getYtDlpBin();
  if (!bin) throw new Error('yt-dlp manquant');
  const platform = detectPlatform(url);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl2-'));

  // Build section arg if start/end provided
  const sectionArg = (opts.startTime || opts.endTime)
    ? `*${opts.startTime || '0'}-${opts.endTime || 'inf'}`
    : null;

  try {
    if (type === 'video') {
      const args = [
        '--no-playlist', '--no-warnings',
        '-o', path.join(tmpDir, '%(title)s.%(ext)s'),
        '-f', opts.formatId ? `${opts.formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
      ];
      if (sectionArg) args.push('--download-sections', sectionArg, '--force-keyframes-at-cuts');
      args.push('--', url);
      await runSpawn(bin, args);
      const file = getBestFile(tmpDir);
      if (!file) throw new Error('Aucun fichier produit');
      return { tmpDir, file, mime: 'video/mp4' };

    } else if (type === 'audio') {
      const ext = opts.audioExt || 'mp3';
      if (!AUDIO_EXTS.has(ext)) throw new Error('audioExt invalide');
      const args = [
        '--no-playlist', '--no-warnings',
        '-o', path.join(tmpDir, '%(title)s.%(ext)s'),
        '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
        '-x', '--audio-format', ext, '--audio-quality', '0',
      ];
      if (sectionArg) args.push('--download-sections', sectionArg, '--force-keyframes-at-cuts');
      args.push('--', url);
      await runSpawn(bin, args);
      const file = getBestFile(tmpDir);
      if (!file) throw new Error('Aucun fichier produit');
      return { tmpDir, file, mime: 'audio/mpeg' };

    } else if (type === 'image') {
      // write-thumbnail downloads the cover image
      const args = [
        '--no-playlist', '--no-warnings', '--skip-download',
        '--write-thumbnail', '--convert-thumbnails', 'jpg',
        '-o', path.join(tmpDir, '%(title)s.%(ext)s'),
        '--', url
      ];
      let file = null;
      try {
        await runSpawn(bin, args);
        file = getBestFile(tmpDir);
      } catch (err) {
        // Instagram image-only: scrape full-res image from HTML
        if (platform === 'instagram') {
          const imgUrl = await fetchInstagramImage(url);
          if (imgUrl) {
            try {
              const imagePath = path.join(tmpDir, 'image.jpg');
              await downloadFileToPath(imgUrl, imagePath, url);
              file = 'image.jpg';
            } catch {}
          }
        }
      }
      if (!file) throw new Error('Impossible extraire image. Post contient peut-être juste des images statiques.');
      return { tmpDir, file, mime: 'image/jpeg' };

    } else if (type === 'text') {
      // Strategy 1: native subtitles / description
      let text = '';
      let filename = 'texte.txt';

      if (platform === 'instagram' || platform === 'twitter') {
        // write-description gives caption / tweet text
        const args = [
          '--no-playlist', '--no-warnings', '--skip-download',
          '--write-description',
          '-o', path.join(tmpDir, '%(title)s.%(ext)s'),
          '--', url
        ];
        await runSpawn(bin, args).catch(() => {});
        const descFile = fs.readdirSync(tmpDir).find(f => f.endsWith('.description'));
        if (descFile) {
          text = fs.readFileSync(path.join(tmpDir, descFile), 'utf8').trim();
          filename = descFile.replace('.description', '.txt');
        }
      }

      if (platform === 'youtube') {
        // Try native auto-subs first
        const subArgs = [
          '--no-playlist', '--no-warnings', '--skip-download',
          '--write-auto-subs', '--sub-langs', 'fr,ar,en,.*',
          '--sub-format', 'vtt',
          '-o', path.join(tmpDir, '%(title)s.%(ext)s'),
          '--', url
        ];
        await runSpawn(bin, subArgs).catch(() => {});
        const vttFile = fs.readdirSync(tmpDir).find(f => f.endsWith('.vtt'));
        if (vttFile) {
          const vttRaw = fs.readFileSync(path.join(tmpDir, vttFile), 'utf8');
          // strip VTT markup → plain text
          text = vttRaw
            .replace(/WEBVTT.*?\n\n/s, '')
            .replace(/\d{2}:\d{2}[\d:.,]+ --> [\d:.,]+.*\n/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          filename = vttFile.replace('.vtt', '.txt');
        }
      }

      // Strategy 2: Whisper fallback if no text found and whisper available
      if (!text && hasWhisper()) {
        const py = getPythonBin();
        const audioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl2-wav-'));
        try {
          const dlArgs = [
            '--no-playlist', '--no-warnings',
            '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            '-x', '--audio-format', 'wav',
            '--postprocessor-args', 'ffmpeg:-ar 16000 -ac 1',
            '-o', path.join(audioDir, 'audio.%(ext)s'),
            '--', url
          ];
          await runSpawn(bin, dlArgs);
          const wavFile = fs.readdirSync(audioDir).find(f => f.endsWith('.wav'));
          if (wavFile) {
            const wavPath = path.join(audioDir, wavFile);
            // Allowlist: these values get templated into Python source below, so
            // anything outside a fixed set is code injection (RCE).
            const model = opts.whisperModel || 'base';
            if (!WHISPER_MODELS.has(model)) throw new Error('Modèle whisper invalide');
            const reqLang = opts.whisperLang || 'auto';
            if (!WHISPER_LANGS.has(reqLang)) throw new Error('Langue whisper invalide');
            const lang = reqLang !== 'auto' ? `language="${reqLang}",` : '';
            const outTxt = path.join(audioDir, 'whisper_out.txt');
            const wavPathEsc = wavPath.replace(/\\/g, '\\\\');
            const outTxtEsc  = outTxt.replace(/\\/g, '\\\\');
            const pyScript = `
import sys, io, whisper
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
m = whisper.load_model("${model}")
r = m.transcribe(r"${wavPathEsc}", ${lang} fp16=False, verbose=False)
txt = r["text"].strip()
with open(r"${outTxtEsc}", "w", encoding="utf-8") as f:
    f.write(txt)
print("ok")
`;
            await runSpawn(py, ['-c', pyScript]);
            if (fs.existsSync(outTxt)) {
              text = fs.readFileSync(outTxt, 'utf8').trim();
            }
            const title = await getVideoTitle(url, bin);
            filename = `${title}_whisper.txt`;
          }
        } finally {
          fs.rmSync(audioDir, { recursive: true, force: true });
        }
      }

      if (!text) throw new Error('Aucun texte disponible pour cette URL');
      const outPath = path.join(tmpDir, filename);
      fs.writeFileSync(outPath, text, 'utf8');
      return { tmpDir, file: filename, mime: 'text/plain' };

    } else if (type === 'subtitle') {
      if (!hasWhisper()) throw new Error('Whisper non disponible');
      const py = getPythonBin();
      const audioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl2-wav-'));
      try {
        const bin = getYtDlpBin();
        const dlArgs = [
          '--no-playlist', '--no-warnings',
          '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
          '-x', '--audio-format', 'wav',
          '--postprocessor-args', 'ffmpeg:-ar 16000 -ac 1',
          '-o', path.join(audioDir, 'audio.%(ext)s'),
          '--', url
        ];
        await runSpawn(bin, dlArgs);
        const wavFile = fs.readdirSync(audioDir).find(f => f.endsWith('.wav'));
        if (!wavFile) throw new Error('Audio introuvable après téléchargement');

        const wavPath = path.join(audioDir, wavFile);
        const model = opts.whisperModel || 'base';
        if (!WHISPER_MODELS.has(model)) throw new Error('Modèle whisper invalide');
        const reqLang = opts.whisperLang || 'auto';
        if (!WHISPER_LANGS.has(reqLang)) throw new Error('Langue whisper invalide');
        const translateLang = opts.translateLang || 'none';
        if (!TRANSLATE_LANGS.has(translateLang)) throw new Error('Langue de traduction invalide');

        const lang = reqLang !== 'auto' ? `language="${reqLang}",` : '';
        const outSrt = path.join(audioDir, 'sub.srt');
        const wavPathEsc = wavPath.replace(/\\/g, '\\\\');
        const outSrtEsc  = outSrt.replace(/\\/g, '\\\\');

        const translateBlock = translateLang !== 'none' ? `
try:
    from deep_translator import GoogleTranslator
    tr = GoogleTranslator(source='auto', target='${translateLang}')
    blocks = [b for b in srt.strip().split("\\n\\n") if b.strip()]
    out = []
    for block in blocks:
        parts = block.split("\\n", 2)
        if len(parts) >= 3:
            try: parts[2] = tr.translate(parts[2]) or parts[2]
            except: pass
            out.append("\\n".join(parts))
        else:
            out.append(block)
    srt = "\\n\\n".join(out)
except ImportError:
    pass
` : '';

        const pyScript = `
import sys, io, whisper
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
def fmt(s):
    h=int(s//3600); m=int((s%3600)//60); sec=int(s%60); ms=int((s%1)*1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
model = whisper.load_model("${model}")
r = model.transcribe(r"${wavPathEsc}", ${lang} fp16=False, verbose=False)
lines = []
for i, seg in enumerate(r["segments"], 1):
    lines += [str(i), f"{fmt(seg['start'])} --> {fmt(seg['end'])}", seg['text'].strip(), ""]
srt = "\\n".join(lines)
${translateBlock}
with open(r"${outSrtEsc}", "w", encoding="utf-8") as f:
    f.write(srt)
print("ok")
`;
        await runSpawn(py, ['-c', pyScript]);
        if (!fs.existsSync(outSrt)) throw new Error('Génération SRT échouée');

        const srtContent = fs.readFileSync(outSrt, 'utf8');
        const videoTitle = await getVideoTitle(url, bin);
        const suffix = translateLang !== 'none' ? `_${translateLang}` : '';
        const srtFilename = `${videoTitle}${suffix}.srt`;
        const destPath = path.join(tmpDir, srtFilename);
        fs.writeFileSync(destPath, srtContent, 'utf8');
        return { tmpDir, file: srtFilename, mime: 'text/plain' };
      } finally {
        fs.rmSync(audioDir, { recursive: true, force: true });
      }
    }

    throw new Error('Type inconnu');
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

// ── single download endpoint (used by frontend for 1 item / 1 type) ──────────

apiRouter.post('/download', requireLocalHeader, async (req, res) => {
  const { url, type, formatId, audioExt, whisperModel, whisperLang, translateLang, startTime, endTime, outputDir } = req.body;
  if (!url || !type) return res.status(400).json({ error: 'url et type requis' });
  try {
    const { tmpDir, file, mime } = await downloadItem(url, type, { formatId, audioExt, whisperModel, whisperLang, translateLang, startTime, endTime });
    const filePath = path.join(tmpDir, file);

    if (outputDir) {
      const rawDir = String(outputDir);
      if (!path.isAbsolute(rawDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(400).json({ error: 'outputDir doit être un chemin absolu' });
      }
      let resolvedDir;
      try {
        resolvedDir = fs.realpathSync(rawDir);
      } catch {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(400).json({ error: `Dossier introuvable : ${rawDir}` });
      }
      // Reject filenames with path traversal sequences or separators
      if (!file || /[/\\]|\.\./.test(file)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(400).json({ error: 'Nom de fichier invalide' });
      }
      const destPath = path.join(resolvedDir, file);
      fs.copyFileSync(filePath, destPath, fs.constants.COPYFILE_EXCL);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return res.json({ saved: true, path: destPath, filename: file });
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Disposition', buildContentDisposition(file));
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', mime);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('close', () => fs.rmSync(tmpDir, { recursive: true, force: true }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── batch endpoint: N urls x M types → ZIP ───────────────────────────────────

apiRouter.post('/batch', requireLocalHeader, async (req, res) => {
  const { items, types, formatId, audioExt, whisperModel, whisperLang, translateLang } = req.body;
  // items: [{ url, label }]
  // types: ['video','audio','image','text'] (selection)
  if (!items?.length || !types?.length) return res.status(400).json({ error: 'items et types requis' });

  // SSE not suitable here since we stream a ZIP — we just stream the zip directly
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', buildContentDisposition('batch_download.zip'));

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  for (const item of items) {
    const { url } = item;
    const folderName = (item.label || url).replace(/[^a-zA-Z0-9_\-\u0621-\u064A ]/g, '_').slice(0, 60);

    for (const type of types) {
      let tmpDir = null;
      try {
        const result = await downloadItem(url, type, { formatId, audioExt, whisperModel, whisperLang, translateLang });
        tmpDir = result.tmpDir;
        const filePath = path.join(tmpDir, result.file);
        archive.file(filePath, { name: `${folderName}/${type}/${result.file}` });
        // need to finalize each file before cleanup — use on-finish hook
        await new Promise(resolve => {
          archive.on('entry', resolve);
          // small delay to let archiver queue the entry
          setTimeout(resolve, 200);
        });
      } catch (err) {
        // add error note as txt file
        const errContent = `Erreur lors du traitement de ${url} (type: ${type})\n${err.message}`;
        archive.append(errContent, { name: `${folderName}/${type}/_ERREUR.txt` });
        await new Promise(r => setTimeout(r, 100));
      } finally {
        if (tmpDir) {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
      }
    }
  }

  archive.finalize();
});

// ── SSE progress for batch ────────────────────────────────────────────────────
// Alternative lightweight approach: client polls /api/batch/status/:jobId
// For simplicity we use a job map in memory

const jobs = new Map();

apiRouter.post('/batch/start', requireLocalHeader, async (req, res) => {
  const { items, types, formatId, audioExt, whisperModel, whisperLang, translateLang } = req.body;
  if (!items?.length || !types?.length) return res.status(400).json({ error: 'items et types requis' });

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const total = items.length * types.length;
  const job = { id: jobId, status: 'running', done: 0, total, log: [], files: [], error: null };
  jobs.set(jobId, job);

  // run async
  (async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl2-batch-'));
    const collected = []; // { zipPath, arcName }

    for (const item of items) {
      const { url } = item;
      const folderName = (item.label || url).replace(/[^a-zA-Z0-9_\-\u0621-\u064A ]/g, '_').slice(0, 60);

      for (const type of types) {
        let tmpDir = null;
        try {
          job.log.push({ url, type, status: 'processing' });
          const result = await downloadItem(url, type, { formatId, audioExt, whisperModel, whisperLang, translateLang });
          tmpDir = result.tmpDir;
          // copy file to stable location inside tmpRoot
          const destDir = path.join(tmpRoot, folderName, type);
          fs.mkdirSync(destDir, { recursive: true });
          const destPath = path.join(destDir, result.file);
          fs.copyFileSync(path.join(tmpDir, result.file), destPath);
          collected.push({ filePath: destPath, arcName: `${folderName}/${type}/${result.file}` });
          job.log[job.log.length - 1].status = 'done';
        } catch (err) {
          const errMsg = `Erreur: ${err.message}`;
          const errPath = path.join(tmpRoot, folderName, type, '_ERREUR.txt');
          fs.mkdirSync(path.join(tmpRoot, folderName, type), { recursive: true });
          fs.writeFileSync(errPath, `${url}\n${type}\n\n${err.message}`, 'utf8');
          collected.push({ filePath: errPath, arcName: `${folderName}/${type}/_ERREUR.txt` });
          job.log[job.log.length - 1].status = 'error';
          job.log[job.log.length - 1].error = errMsg;
        } finally {
          if (tmpDir) try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }
        job.done++;
      }
    }

    // build zip
    const zipPath = path.join(tmpRoot, 'batch_download.zip');
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.pipe(output);
      for (const { filePath, arcName } of collected) archive.file(filePath, { name: arcName });
      archive.finalize();
      output.on('close', resolve);
      archive.on('error', reject);
    });

    job.zipPath = zipPath;
    job.tmpRoot = tmpRoot;
    job.status  = 'done';
  })().catch(err => {
    job.status = 'error';
    job.error  = err.message;
  });

  res.json({ jobId, total });
});

apiRouter.get('/batch/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job inconnu' });
  res.json({ status: job.status, done: job.done, total: job.total, log: job.log, error: job.error });
});

apiRouter.get('/batch/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done') return res.status(400).json({ error: 'ZIP non prêt' });
  const stat = fs.statSync(job.zipPath);
  res.setHeader('Content-Disposition', buildContentDisposition('batch_download.zip'));
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Type', 'application/zip');
  const stream = fs.createReadStream(job.zipPath);
  stream.pipe(res);
  stream.on('close', () => {
    try { fs.rmSync(job.tmpRoot, { recursive: true, force: true }); } catch {}
    jobs.delete(job.id);
  });
});

function timeToSeconds(t) {
  const parts = t.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// ── trim local file ───────────────────────────────────────────────────────────

const upload = multer({ dest: os.tmpdir() });

apiRouter.post('/trim-local', requireLocalHeader, upload.single('file'), async (req, res) => {
  const { type, audioExt, startTime, endTime } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  if (!startTime && !endTime) return res.status(400).json({ error: 'startTime ou endTime requis' });

  const ffmpegBin = hasFfmpeg();
  if (!ffmpegBin) return res.status(500).json({ error: 'ffmpeg manquant' });

  const inputPath = req.file.path;
  if (type === 'audio' && !AUDIO_EXTS.has(audioExt || 'mp3')) {
    return res.status(400).json({ error: 'audioExt invalide' });
  }
  const ext       = type === 'audio' ? (audioExt || 'mp3') : 'mp4';
  const outName   = path.basename(req.file.originalname || 'trim', path.extname(req.file.originalname || '')).replace(/[^\w\-]/g, '_') + '_trim.' + ext;
  const outPath   = path.join(os.tmpdir(), outName);
  if (path.dirname(path.resolve(outPath)) !== path.resolve(os.tmpdir())) {
    return res.status(400).json({ error: 'nom de fichier invalide' });
  }

  try {
    const args = ['-y'];
    if (startTime) args.push('-ss', startTime);
    args.push('-i', inputPath);
    if (endTime && startTime) {
      // -to on output side counts from output timeline start (0).
      // Since -ss before -i does not shift output timeline, compute duration manually.
      const durationSec = timeToSeconds(endTime) - timeToSeconds(startTime);
      args.push('-t', String(durationSec));
    } else if (endTime) {
      args.push('-t', String(timeToSeconds(endTime)));
    }
    if (type === 'audio') {
      args.push('-vn', '-acodec', ext === 'mp3' ? 'libmp3lame' : ext === 'aac' ? 'aac' : ext === 'opus' ? 'libopus' : 'aac');
    } else {
      args.push('-c', 'copy');
    }
    args.push(outPath);

    await runSpawn(ffmpegBin, args);

    const stat = fs.statSync(outPath);
    res.setHeader('Content-Disposition', buildContentDisposition(outName));
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', type === 'audio' ? 'audio/mpeg' : 'video/mp4');
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => {
      try { fs.unlinkSync(outPath); } catch {}
      try { fs.unlinkSync(inputPath); } catch {}
    });
  } catch (err) {
    try { fs.unlinkSync(inputPath); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// ── transcribe-local: Whisper on a local file ─────────────────────────────────

const MEDIA_EXTS = new Set([
  '.mp4','.mkv','.avi','.mov','.webm','.flv','.m4v','.wmv','.mpg','.mpeg',
  '.mp3','.wav','.m4a','.aac','.ogg','.flac','.opus','.wma',
]);

apiRouter.post('/transcribe-local', requireLocalHeader, async (req, res) => {
  const { filePath, type = 'text', whisperModel, whisperLang, translateLang, outputDir } = req.body;

  if (!filePath || typeof filePath !== 'string') return res.status(400).json({ error: 'filePath requis' });
  if (!path.isAbsolute(filePath)) return res.status(400).json({ error: 'filePath doit être un chemin absolu' });

  let resolvedFile;
  try { resolvedFile = fs.realpathSync(filePath); }
  catch { return res.status(400).json({ error: 'Fichier introuvable' }); }

  if (!MEDIA_EXTS.has(path.extname(resolvedFile).toLowerCase()))
    return res.status(400).json({ error: 'Extension non supportée (vidéo ou audio requis)' });

  if (!hasWhisper()) return res.status(500).json({ error: 'Whisper non disponible' });
  const py       = getPythonBin();
  const ffmpegBin = hasFfmpeg();
  if (!ffmpegBin) return res.status(500).json({ error: 'ffmpeg manquant' });

  const model  = whisperModel || 'base';
  if (!WHISPER_MODELS.has(model)) return res.status(400).json({ error: 'Modèle whisper invalide' });
  const reqLang = whisperLang || 'auto';
  if (!WHISPER_LANGS.has(reqLang)) return res.status(400).json({ error: 'Langue whisper invalide' });
  const tLang  = translateLang || 'none';
  if (!TRANSLATE_LANGS.has(tLang)) return res.status(400).json({ error: 'Langue de traduction invalide' });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-'));
  try {
    const wavPath    = path.join(tmpDir, 'audio.wav');
    const wavPathEsc = wavPath.replace(/\\/g, '\\\\');
    await runSpawn(ffmpegBin, ['-y', '-i', resolvedFile, '-ar', '16000', '-ac', '1', '-vn', wavPath]);

    const baseName = path.basename(resolvedFile, path.extname(resolvedFile))
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150);
    const lang = reqLang !== 'auto' ? `language="${reqLang}",` : '';

    let outName, outPath;

    if (type === 'subtitle') {
      const srtTmp    = path.join(tmpDir, 'sub.srt');
      const srtTmpEsc = srtTmp.replace(/\\/g, '\\\\');
      const translateBlock = tLang !== 'none' ? `
try:
    from deep_translator import GoogleTranslator
    tr = GoogleTranslator(source='auto', target='${tLang}')
    blocks = [b for b in srt.strip().split("\\n\\n") if b.strip()]
    out = []
    for block in blocks:
        parts = block.split("\\n", 2)
        if len(parts) >= 3:
            try: parts[2] = tr.translate(parts[2]) or parts[2]
            except: pass
            out.append("\\n".join(parts))
        else:
            out.append(block)
    srt = "\\n\\n".join(out)
except ImportError:
    pass
` : '';
      const pyScript = `
import sys, io, whisper
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
def fmt(s):
    h=int(s//3600); m=int((s%3600)//60); sec=int(s%60); ms=int((s%1)*1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
model = whisper.load_model("${model}")
r = model.transcribe(r"${wavPathEsc}", ${lang} fp16=False, verbose=False)
lines = []
for i, seg in enumerate(r["segments"], 1):
    lines += [str(i), f"{fmt(seg['start'])} --> {fmt(seg['end'])}", seg['text'].strip(), ""]
srt = "\\n".join(lines)
${translateBlock}
with open(r"${srtTmpEsc}", "w", encoding="utf-8") as f:
    f.write(srt)
print("ok")
`;
      await runSpawn(py, ['-c', pyScript]);
      if (!fs.existsSync(srtTmp)) throw new Error('Génération SRT échouée');
      const suffix = tLang !== 'none' ? `_${tLang}` : '';
      outName = `${baseName}${suffix}.srt`;
      outPath = path.join(tmpDir, outName);
      fs.renameSync(srtTmp, outPath);
    } else {
      const txtTmp    = path.join(tmpDir, 'out.txt');
      const txtTmpEsc = txtTmp.replace(/\\/g, '\\\\');
      const pyScript = `
import sys, io, whisper
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
model = whisper.load_model("${model}")
r = model.transcribe(r"${wavPathEsc}", ${lang} fp16=False, verbose=False)
with open(r"${txtTmpEsc}", "w", encoding="utf-8") as f:
    f.write(r["text"].strip())
print("ok")
`;
      await runSpawn(py, ['-c', pyScript]);
      if (!fs.existsSync(txtTmp)) throw new Error('Transcription échouée');
      outName = `${baseName}_whisper.txt`;
      outPath = path.join(tmpDir, outName);
      fs.renameSync(txtTmp, outPath);
    }

    if (outputDir) {
      const rawDir = String(outputDir);
      if (!path.isAbsolute(rawDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.status(400).json({ error: 'outputDir doit être absolu' });
      }
      let resolvedDir;
      try { resolvedDir = fs.realpathSync(rawDir); }
      catch { fs.rmSync(tmpDir, { recursive: true, force: true }); return res.status(400).json({ error: `Dossier introuvable : ${rawDir}` }); }
      if (/[/\\]|\.\./.test(outName)) { fs.rmSync(tmpDir, { recursive: true, force: true }); return res.status(400).json({ error: 'Nom fichier invalide' }); }
      const dest = path.join(resolvedDir, outName);
      fs.copyFileSync(outPath, dest, fs.constants.COPYFILE_EXCL);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return res.json({ saved: true, path: dest, filename: outName });
    }

    const stat = fs.statSync(outPath);
    res.setHeader('Content-Disposition', buildContentDisposition(outName));
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => fs.rmSync(tmpDir, { recursive: true, force: true }));
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  YT-DL v2  →  http://localhost:${PORT}`);
  console.log(`  yt-dlp  : ${getYtDlpBin()  ? '✓' : '✗'}`);
  console.log(`  ffmpeg  : ${hasFfmpeg()     ? '✓' : '✗'}`);
  console.log(`  python  : ${getPythonBin()  ? '✓' : '✗'}`);
  console.log(`  whisper : ${hasWhisper()    ? '✓' : '✗'}\n`);
});
