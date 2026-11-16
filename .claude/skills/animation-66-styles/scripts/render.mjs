#!/usr/bin/env node
// Rendu MP4 d'une animation texte dans l'un des 66 styles.
// Exemples :
//   node render.mjs --list
//   node render.mjs --style neon-nuit --text "Bonjour|Bienvenue dans la *formation*" --out video.mp4
//   node render.mjs --style 12 --script scenes.json --format 16:9 --audio voix.mp3 --out video.mp4
//   node render.mjs --catalogue --out catalogue.png        (planche des 66 styles)
//   node render.mjs --showreel --out showreel.mp4          (démo de chaque style, 1,5 s chacun)
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // Playwright global ou local
const args = process.argv.slice(2);
const opt = {}; for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; opt[k] = v; } }

const FORMATS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const [W, H] = FORMATS[opt.format || '9:16'] || opt.format.split('x').map(Number);
const FPS = Number(opt.fps || 30);
const scale = Number(opt.scale || 1); // 0.5 = aperçu rapide

async function page() {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await p.setContent('<html><body style="margin:0;background:#000"><canvas id="c"></canvas></body></html>');
  await p.addScriptTag({ content: fs.readFileSync(path.join(here, 'engine.js'), 'utf8') });
  await p.evaluate(() => document.fonts.ready);
  return { browser, p };
}

function ffmpegWriter(out, extra = []) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...extra,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  return { write: buf => new Promise(r => ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)), end: () => new Promise((r, j) => { ff.on('close', c => c ? j(new Error('ffmpeg ' + c)) : r()); ff.stdin.end(); }) };
}

async function renderFrames(p, cfg, writer, label) {
  const info = await p.evaluate(c => window.setup(c), cfg);
  const total = cfg.forceDuration || info.total + (cfg.tail ?? .6); const n = Math.round(total * FPS);
  for (let f = 0; f < n; f++) {
    const url = await p.evaluate(t => window.frame(t), f / FPS);
    await writer.write(Buffer.from(url.split(',')[1], 'base64'));
    if (f % 30 === 0) process.stdout.write(`\r${label || info.style} : ${Math.round(f / n * 100)}%   `);
  }
  process.stdout.write(`\r${label || info.style} : 100%   \n`);
  return { ...info, total };
}

function scenesFromOpts() {
  if (opt.script) { const j = JSON.parse(fs.readFileSync(opt.script, 'utf8')); return Array.isArray(j) ? j : j.scenes; }
  if (opt.text) return String(opt.text).split('|').map(t => ({ text: t.trim() }));
  return [{ text: 'Votre *message* ici', kicker: 'Exemple' }];
}

const { browser, p } = await page();
try {
  const styles = await p.evaluate(() => window.STYLES.map(s => ({ n: s.n, id: s.id, name: s.name, bg: s.bg, anim: s.anim })));

  if (opt.list) {
    styles.forEach(s => console.log(`${String(s.n).padStart(2)}  ${s.id.padEnd(16)} ${s.name.padEnd(24)} fond=${s.bg}, anim=${s.anim}`));

  } else if (opt.catalogue) { // planche contact : 1 image par style, grille 11×6
    const out = opt.out || 'catalogue.png'; const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.cat-'));
    const tw = 360, th = Math.round(360 * H / W);
    for (const s of styles) {
      await p.evaluate(c => window.setup(c), { width: tw, height: th, style: s.id, scenes: [{ text: s.name, kicker: `#${s.n}` }] });
      const url = await p.evaluate(t => window.frame(t), 1.6);
      fs.writeFileSync(path.join(tmp, `${String(s.n).padStart(2, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, '%02d.jpg'), '-vf', `tile=12x${Math.ceil(styles.length / 12)}:padding=6:margin=6:color=white`, '-frames:v', '1', out]);
    fs.rmSync(tmp, { recursive: true }); console.log('Catalogue :', out);

  } else if (opt.showreel) { // un extrait par style
    const out = opt.out || 'showreel.mp4'; const w = ffmpegWriter(out);
    const pick = opt.styles ? String(opt.styles).split(',') : styles.map(s => s.id);
    for (const id of pick) { const s = styles.find(x => x.id === id || String(x.n) === id);
      await renderFrames(p, { width: Math.round(W * scale), height: Math.round(H * scale), style: s.id, scenes: [{ text: opt.text || s.name, kicker: `Style ${s.n}/${styles.length}`, duration: 1.8 }], forceDuration: 1.8 }, w, `${s.n} ${s.name}`); }
    await w.end(); console.log('Showreel :', out);

  } else {
    const style = opt.style || 'minimal-noir'; const out = opt.out || `animation-${style}.mp4`;
    const cfg = { width: Math.round(W * scale), height: Math.round(H * scale), style, scenes: scenesFromOpts(), watermark: opt.watermark, upper: !!opt.upper,
      colors: opt.colors ? JSON.parse(opt.colors) : undefined, title: opt.title, headerRight: opt.header };
    if (opt.script) { const j = JSON.parse(fs.readFileSync(opt.script, 'utf8')); if (!Array.isArray(j)) { for (const k of ['title', 'headerRight', 'logo', 'watermark']) if (j[k] && !cfg[k]) cfg[k] = j[k]; } }
    const logo = opt.logo || cfg.logo; if (logo) { const ext = path.extname(logo).slice(1).toLowerCase().replace('jpg', 'jpeg'); cfg.logo = `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,` + fs.readFileSync(logo).toString('base64'); }
    let audioDur;
    if (opt.audio) { // cale la durée totale sur l'audio en étirant les scènes proportionnellement
      audioDur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', opt.audio]).toString());
      const est0 = x => x.duration || Math.max(1.8, .9 + ((x.text || '') + (x.caption || '')).length * .055); const est = cfg.scenes.reduce((s, x) => s + est0(x), 0);
      if (!cfg.scenes.every(x => x.duration)) cfg.scenes.forEach(x => { x.duration = est0(x) * audioDur / est; });
      cfg.forceDuration = audioDur;
    }
    const silent = opt.audio ? out.replace(/\.mp4$/, '') + '.noaudio.mp4' : out;
    const w = ffmpegWriter(silent); const info = await renderFrames(p, cfg, w); await w.end();
    if (opt.audio) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', opt.audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out]); fs.rmSync(silent); }
    console.log(`OK : ${out}  (style #${info.n} ${info.style}, ${info.total.toFixed(1)} s, ${cfg.width}x${cfg.height}@${FPS})`);
  }
} finally { await browser.close(); }
