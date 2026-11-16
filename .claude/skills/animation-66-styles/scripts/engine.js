// Moteur d'animation : 66 styles = fond × animation de texte × palette × police × effets.
// Tourne dans le navigateur (canvas 2D). Exposé : window.setup(config) puis window.frame(t) -> dataURL.
(function () {
  const SANS = '"Inter Display", Inter, "DejaVu Sans", sans-serif';
  const SERIF = '"DejaVu Serif", "Bitstream Charter", Caladea, serif';
  const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace';
  const FONTS = { sans: SANS, serif: SERIF, mono: MONO };

  // Générateur pseudo-aléatoire déterministe (même rendu à chaque export)
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = { out: p => 1 - Math.pow(1 - p, 3), inOut: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    back: p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    elastic: p => (p === 0 || p === 1) ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI / 3)) + 1,
    bounce: p => { const n = 7.5625, d = 2.75; if (p < 1 / d) return n * p * p; if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75; if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375; return n * (p -= 2.625 / d) * p + .984375; } };

  // ---------------------------------------------------------------- 66 STYLES
  // [id, nom, fond, animation texte, police, poids, [fond1, fond2, texte, accent], effets]
  const S = [
    ['neon-nuit', 'Néon nuit', 'grid', 'neon', 'sans', 800, ['#0b0221', '#2b0a4a', '#ff4fd8', '#22e6ff'], ['glow', 'vignette']],
    ['synthwave', 'Synthwave 80s', 'grid', 'slideUp', 'sans', 900, ['#14002b', '#ff2e88', '#ffe66d', '#00f0ff'], ['glow', 'scan']],
    ['minimal-blanc', 'Minimal blanc', 'solid', 'fade', 'sans', 600, ['#f7f7f5', '#f7f7f5', '#111111', '#ff5a36'], []],
    ['minimal-noir', 'Minimal noir', 'solid', 'rise', 'sans', 700, ['#0d0d0d', '#0d0d0d', '#f5f5f5', '#c6ff3d'], []],
    ['corporate', 'Corporate bleu', 'gradient', 'slideLeft', 'sans', 700, ['#0a2a66', '#1e64d6', '#ffffff', '#7fd1ff'], ['vignette']],
    ['luxe-or', 'Luxe or', 'radial', 'blurIn', 'serif', 400, ['#0c0a07', '#2a2112', '#f3e3b5', '#d4af37'], ['grain', 'vignette']],
    ['retro-tv', 'Rétro TV', 'noise', 'glitch', 'mono', 700, ['#101410', '#1d2a1d', '#d8ffd8', '#ff3b3b'], ['scan', 'rgb', 'vignette']],
    ['matrix', 'Code Matrix', 'matrix', 'scramble', 'mono', 700, ['#000400', '#001a00', '#4dff6a', '#d6ffd9'], ['glow']],
    ['terminal', 'Terminal hacker', 'solid', 'typewriter', 'mono', 500, ['#0b0f0b', '#0b0f0b', '#33ff66', '#ffd23f'], ['scan', 'glow']],
    ['pop-bd', 'Pop BD', 'halftone', 'pop', 'sans', 900, ['#ffde21', '#ff4757', '#111111', '#ffffff'], ['stroke']],
    ['bonbon', 'Bonbon pastel', 'blobs', 'bounce', 'sans', 800, ['#ffd6e8', '#c9f0ff', '#5b2a86', '#ff6fae'], []],
    ['enfant', 'Monde enfant', 'confetti', 'elastic', 'sans', 900, ['#fff4c2', '#ffd1a1', '#2d3a8c', '#ff5d8f'], ['stroke']],
    ['aurore', 'Aurore boréale', 'aurora', 'fade', 'sans', 300, ['#020617', '#0f2b3d', '#e6fffa', '#5eead4'], ['glow']],
    ['espace', 'Espace profond', 'stars', 'zoomOut', 'sans', 800, ['#000000', '#0a0f2c', '#ffffff', '#9fb4ff'], ['vignette']],
    ['galaxie', 'Galaxie', 'stars', 'spin', 'sans', 900, ['#05010f', '#3b0764', '#f5d0fe', '#f0abfc'], ['glow', 'vignette']],
    ['ocean', 'Océan', 'waves', 'wave', 'sans', 700, ['#03254c', '#1167b1', '#e8f7ff', '#7ee0ff'], []],
    ['coucher-soleil', 'Coucher de soleil', 'sunburst', 'rise', 'serif', 700, ['#ff7e5f', '#feb47b', '#3b1027', '#fff2d6'], ['vignette']],
    ['foret', 'Forêt zen', 'bokeh', 'blurIn', 'serif', 400, ['#0f2417', '#2f5d3a', '#f1f7ee', '#b7e4a3'], ['grain']],
    ['papier', 'Papier craft', 'paper', 'jitter', 'serif', 700, ['#e9dcc3', '#d9c7a3', '#3a2a1a', '#b5452c'], ['grain']],
    ['cahier', 'Cahier d’école', 'notebook', 'typewriter', 'serif', 700, ['#fbfbf7', '#fbfbf7', '#1c2b6b', '#e0413a'], []],
    ['tableau-noir', 'Tableau noir', 'chalk', 'jitter', 'sans', 600, ['#1f3a2e', '#24443a', '#f2f2ea', '#ffe27a'], ['grain']],
    ['blueprint', 'Plan d’architecte', 'grid2d', 'drawIn', 'mono', 600, ['#0b3d91', '#0e4fb8', '#e6f0ff', '#ffffff'], []],
    ['cinema', 'Cinéma', 'radial', 'fade', 'serif', 400, ['#050505', '#1b1b1b', '#f2efe9', '#c9a227'], ['letterbox', 'grain', 'vignette']],
    ['trailer', 'Bande-annonce', 'radial', 'stamp', 'serif', 900, ['#000000', '#262626', '#ffffff', '#e50914'], ['letterbox', 'shake', 'vignette']],
    ['film-ancien', 'Film ancien', 'noise', 'flicker', 'serif', 700, ['#2b2418', '#4a3f2b', '#efe3c8', '#ffffff'], ['grain', 'scratches', 'vignette']],
    ['noir-blanc', 'Noir & blanc', 'gradient', 'slideDown', 'serif', 700, ['#000000', '#3a3a3a', '#ffffff', '#bdbdbd'], ['grain', 'vignette']],
    ['brutaliste', 'Brutaliste', 'stripes', 'stamp', 'sans', 900, ['#ff3d00', '#ff3d00', '#000000', '#ffffff'], ['border']],
    ['suisse', 'Style suisse', 'solid', 'slideLeft', 'sans', 800, ['#e30613', '#e30613', '#ffffff', '#111111'], []],
    ['bauhaus', 'Bauhaus', 'shapes', 'pop', 'sans', 900, ['#f4ecd8', '#f4ecd8', '#111111', '#d7263d'], []],
    ['memphis', 'Memphis 90s', 'confetti', 'swing', 'sans', 900, ['#fff3e6', '#ffd6f0', '#1a1a1a', '#00b3a4'], ['stroke']],
    ['vaporwave', 'Vaporwave', 'sunburst', 'wave', 'serif', 700, ['#ff71ce', '#01cdfe', '#fffb96', '#b967ff'], ['scan', 'rgb']],
    ['cyberpunk', 'Cyberpunk', 'grid', 'glitch', 'mono', 800, ['#0d0221', '#261447', '#fcee0a', '#00f6ff'], ['rgb', 'scan', 'glow']],
    ['glitch-art', 'Glitch art', 'noise', 'glitch', 'sans', 900, ['#0a0a0a', '#151515', '#ffffff', '#ff0055'], ['rgb', 'shake']],
    ['hologramme', 'Hologramme', 'grid2d', 'flicker', 'sans', 300, ['#001018', '#002838', '#9ffcff', '#ffffff'], ['scan', 'glow']],
    ['tech-startup', 'Tech startup', 'blobs', 'rise', 'sans', 800, ['#0f0c29', '#302b63', '#ffffff', '#8b5cf6'], ['glow']],
    ['gradient-mesh', 'Dégradé fluide', 'blobs', 'slideUp', 'sans', 800, ['#ff9a8b', '#a18cd1', '#ffffff', '#1d1d3b'], []],
    ['instagram', 'Story Instagram', 'gradient', 'pop', 'sans', 900, ['#833ab4', '#fd1d1d', '#ffffff', '#fcb045'], ['stroke']],
    ['tiktok', 'TikTok punchy', 'solid', 'stamp', 'sans', 900, ['#010101', '#010101', '#ffffff', '#fe2c55'], ['rgb', 'shake']],
    ['youtube', 'Miniature YouTube', 'sunburst', 'bounce', 'sans', 900, ['#ff0000', '#ffcc00', '#ffffff', '#111111'], ['stroke']],
    ['podcast', 'Podcast', 'bars', 'fade', 'sans', 700, ['#1a1423', '#372549', '#f8f0fb', '#eacdc2'], []],
    ['musique', 'Clip musique', 'bars', 'wave', 'sans', 900, ['#000000', '#1f005c', '#ffffff', '#ff00a0'], ['glow']],
    ['disco', 'Disco', 'bokeh', 'spin', 'serif', 900, ['#2a0845', '#6441a5', '#ffd700', '#ff4fd8'], ['glow']],
    ['fete', 'Fête', 'confetti', 'bounce', 'sans', 900, ['#2b1055', '#7597de', '#ffffff', '#ffd93d'], ['stroke']],
    ['mariage', 'Mariage élégant', 'bokeh', 'blurIn', 'serif', 400, ['#fbf6f0', '#f1e3d3', '#5c4033', '#c9a66b'], []],
    ['noel', 'Noël', 'snow', 'dropIn', 'serif', 700, ['#7a0c0c', '#2e0202', '#fff8e7', '#ffd166'], ['vignette']],
    ['halloween', 'Halloween', 'fog', 'flicker', 'serif', 900, ['#120a1c', '#2b0f3a', '#ff7518', '#b6ff3b'], ['vignette', 'grain']],
    ['horreur', 'Horreur', 'fog', 'jitter', 'serif', 900, ['#050000', '#2a0000', '#e10600', '#ffffff'], ['shake', 'grain', 'vignette']],
    ['sport', 'Sport énergie', 'stripes', 'slideLeft', 'sans', 900, ['#0b0b0b', '#1d1d1d', '#ffffff', '#c6ff00'], ['shake']],
    ['gaming', 'Gaming arcade', 'pixels', 'pop', 'mono', 800, ['#120458', '#000000', '#ffffff', '#00ff9f'], ['scan', 'stroke']],
    ['pixel-8bit', 'Pixel 8-bit', 'pixels', 'typewriter', 'mono', 800, ['#1d2b53', '#7e2553', '#fff1e8', '#ffec27'], ['scan']],
    ['nature', 'Nature douce', 'blobs', 'rise', 'serif', 600, ['#e8f3e8', '#cfe8d5', '#1f3d2b', '#5a9e6f'], []],
    ['desert', 'Désert', 'dunes', 'fade', 'serif', 700, ['#f6d6a8', '#e09f5e', '#4a2410', '#ffffff'], ['grain']],
    ['montagne', 'Montagne', 'mountains', 'slideUp', 'sans', 800, ['#cfe3f3', '#6f8fb3', '#0e1f33', '#ffffff'], []],
    ['ville-nuit', 'Ville la nuit', 'city', 'neon', 'sans', 800, ['#05070f', '#141b36', '#ffffff', '#ffb000'], ['glow', 'vignette']],
    ['pluie', 'Pluie mélancolique', 'rain', 'fade', 'serif', 400, ['#1c2530', '#3a4a5c', '#e5edf5', '#9ec5e8'], ['vignette', 'grain']],
    ['feu', 'Feu', 'embers', 'flicker', 'sans', 900, ['#120400', '#5c1300', '#ffe9b0', '#ff6a00'], ['glow', 'vignette']],
    ['glace', 'Glace', 'snow', 'blurIn', 'sans', 300, ['#e6f7ff', '#a6d8f0', '#0b3954', '#ffffff'], []],
    ['science', 'Science / molécules', 'network', 'drawIn', 'sans', 600, ['#03101f', '#0a2a4a', '#e0f2ff', '#3dd6ff'], ['glow']],
    ['education', 'Éducatif clair', 'grid2d', 'bounce', 'sans', 800, ['#ffffff', '#eef4ff', '#1b2a4e', '#ff8a00'], []],
    ['finance', 'Finance / data', 'chart', 'slideUp', 'sans', 800, ['#06141b', '#11212d', '#e9f5ee', '#22c55e'], []],
    ['magazine', 'Magazine mode', 'solid', 'slideDown', 'serif', 900, ['#f2ebe5', '#f2ebe5', '#111111', '#b3001b'], ['border']],
    ['japon', 'Japon zen', 'sun', 'blurIn', 'serif', 400, ['#f5efe6', '#f5efe6', '#1a1a1a', '#bc002d'], ['grain']],
    ['graffiti', 'Graffiti urbain', 'bricks', 'stamp', 'sans', 900, ['#3b3b3b', '#2a2a2a', '#ff3cac', '#3cf2ff'], ['stroke', 'grain']],
    ['aquarelle', 'Aquarelle', 'watercolor', 'fade', 'serif', 700, ['#fdfaf5', '#fdfaf5', '#2b3a55', '#e07a5f'], ['grain']],
    ['kaleido', 'Kaléidoscope', 'kaleido', 'spin', 'sans', 900, ['#120136', '#035aa6', '#ffffff', '#ffd400'], ['stroke']],
    ['hypnose', 'Hypnose', 'tunnel', 'zoomOut', 'sans', 900, ['#000000', '#ffffff', '#ff0055', '#ffffff'], ['stroke']],
  ];
  const STYLES = S.map((s, i) => ({ n: i + 1, id: s[0], name: s[1], bg: s[2], anim: s[3], font: s[4], weight: s[5],
    c: { b1: s[6][0], b2: s[6][1], txt: s[6][2], acc: s[6][3] }, fx: s[7] }));

  // ---------------------------------------------------------------- FONDS
  let W, H, ctx, cv, st, seedBase = 7, cache = {};
  const U = () => Math.min(W, H) / 1080; // unité relative

  function lin(a, b, ang = Math.PI / 2) { const g = ctx.createLinearGradient(W / 2 - Math.cos(ang) * W, H / 2 - Math.sin(ang) * H, W / 2 + Math.cos(ang) * W, H / 2 + Math.sin(ang) * H); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function fill(c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
  function pts(key, n, f) { if (!cache[key]) { const r = rng(seedBase + key.length * 31 + n); cache[key] = Array.from({ length: n }, () => f(r)); } return cache[key]; }

  const BG = {
    solid: (t, c) => fill(c.b1),
    gradient: (t, c) => fill(lin(c.b1, c.b2, Math.PI / 4 + Math.sin(t * .4) * .5)),
    radial: (t, c) => { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * (.7 + .05 * Math.sin(t))); g.addColorStop(0, c.b2); g.addColorStop(1, c.b1); fill(g); },
    grid: (t, c) => { // grille synthwave en perspective
      fill(lin(c.b1, c.b2)); const hz = H * .55; ctx.save(); ctx.strokeStyle = c.acc; ctx.globalAlpha = .55; ctx.lineWidth = 2 * U();
      for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * .02, hz); ctx.lineTo(W / 2 + i * W * .25, H); ctx.stroke(); }
      for (let k = 0; k < 18; k++) { const z = ((k + (t * 1.2) % 1) / 18); const y = hz + (H - hz) * z * z; ctx.globalAlpha = .55 * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.globalAlpha = 1; const g = ctx.createRadialGradient(W / 2, hz, 0, W / 2, hz, W * .35); g.addColorStop(0, c.txt + '88'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); },
    grid2d: (t, c) => { fill(c.b1); ctx.save(); ctx.strokeStyle = c.txt; const s = 60 * U(); const o = (t * 10 * U()) % s;
      for (let x = -s + o; x < W; x += s) { ctx.globalAlpha = .12; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = -s + o; y < H; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore(); },
    notebook: (t, c) => { fill(c.b1); ctx.save(); ctx.strokeStyle = '#9cc3e8'; ctx.lineWidth = 2 * U(); for (let y = 80 * U(); y < H; y += 56 * U()) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = c.acc; ctx.beginPath(); ctx.moveTo(110 * U(), 0); ctx.lineTo(110 * U(), H); ctx.stroke(); ctx.restore(); },
    chalk: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); pts('chalk', 60, r => [r() * W, r() * H, r() * 200 + 40, r() * 6]).forEach(p => { ctx.globalAlpha = .05; ctx.strokeStyle = '#fff'; ctx.lineWidth = 20 * U(); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + p[2] * U(), p[1] + p[3]); ctx.stroke(); }); ctx.restore(); },
    stars: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); pts('stars', 260, r => [r(), r(), r() * 2.5 + .3, r() * 6]).forEach(p => { const z = 1 + t * .03 * p[2]; const x = W / 2 + (p[0] - .5) * W * z, y = H / 2 + (p[1] - .5) * H * z;
      ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 2 + p[3])); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, p[2] * U() * 1.6, 0, 7); ctx.fill(); }); ctx.restore(); },
    bokeh: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; pts('bokeh', 30, r => [r(), r(), r() * 120 + 40, r() * 6, r() < .5]).forEach(p => {
      const x = (p[0] * W + Math.sin(t * .3 + p[3]) * 60 * U()), y = ((p[1] * H - t * 25 * U()) % H + H) % H; const g = ctx.createRadialGradient(x, y, 0, x, y, p[2] * U());
      g.addColorStop(0, (p[4] ? c.acc : c.txt) + '55'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x - p[2] * U(), y - p[2] * U(), p[2] * 2 * U(), p[2] * 2 * U()); }); ctx.restore(); },
    blobs: (t, c) => { fill(c.b1); ctx.save(); ctx.filter = `blur(${80 * U()}px)`; [[c.b2, .3, .3, 1], [c.acc, .7, .6, 1.3], [c.b2, .5, .9, .8], [c.txt === '#ffffff' ? c.acc : c.b2, .2, .8, 1.1]].forEach((b, i) => {
      ctx.globalAlpha = .75; ctx.fillStyle = b[0]; ctx.beginPath(); ctx.arc(W * (b[1] + .15 * Math.sin(t * .5 * b[3] + i)), H * (b[2] + .1 * Math.cos(t * .4 * b[3] + i)), Math.max(W, H) * .28, 0, 7); ctx.fill(); }); ctx.restore(); },
    aurora: (t, c) => { fill(c.b1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${40 * U()}px)`; [c.acc, c.b2, '#a78bfa'].forEach((col, k) => { ctx.fillStyle = col; ctx.globalAlpha = .45; ctx.beginPath(); const yy = x => H * (.25 + .1 * k) + Math.sin(x / W * 6 + t * .7 + k * 2) * H * .06 + Math.sin(x / W * 13 + t * 1.3) * H * .02;
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, yy(x)); for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, yy(x) + H * (.12 + .05 * Math.sin(x / W * 4 + t + k))); ctx.closePath(); ctx.fill(); }); ctx.restore(); },
    waves: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); for (let k = 0; k < 6; k++) { ctx.fillStyle = c.acc; ctx.globalAlpha = .08 + k * .03; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * (.55 + k * .08) + Math.sin(x / W * 8 + t * (1 + k * .2) + k) * 30 * U()); ctx.lineTo(W, H); ctx.fill(); } ctx.restore(); },
    sunburst: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * .15); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .12; const R = Math.max(W, H);
      for (let i = 0; i < 24; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * Math.PI / 12, (i + 1) * Math.PI / 12); ctx.fill(); } ctx.restore(); },
    stripes: (t, c) => { fill(c.b1); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 5); ctx.fillStyle = c.acc; ctx.globalAlpha = .12; const s = 90 * U(), R = Math.max(W, H) * 1.5, o = (t * 120 * U()) % (s * 2);
      for (let x = -R + o; x < R; x += s * 2) ctx.fillRect(x, -R, s, R * 2); ctx.restore(); },
    halftone: (t, c) => { fill(c.b1); ctx.save(); ctx.fillStyle = c.b2; const s = 34 * U(); for (let y = 0; y < H + s; y += s) for (let x = 0; x < W + s; x += s) { const d = Math.hypot(x - W / 2, y - H / 2) / Math.max(W, H);
      const r = s * .5 * clamp(1 - d * 1.4 + .15 * Math.sin(t * 2 - d * 10)); ctx.beginPath(); ctx.arc(x + (y / s % 2) * s / 2, y, r, 0, 7); ctx.fill(); } ctx.restore(); },
    confetti: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); const cols = [c.acc, c.txt, '#ffb703', '#06d6a0', '#ef476f', '#118ab2']; pts('conf', 90, r => [r(), r(), r() * 6, r() * 18 + 10, r() * 6 | 0, r() * .5 + .5]).forEach(p => {
      const y = ((p[1] * H + t * 160 * U() * p[5]) % (H + 40)) - 20, x = p[0] * W + Math.sin(t * 2 + p[2]) * 30 * U(); ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 * p[5] + p[2]); ctx.fillStyle = cols[p[4]]; ctx.globalAlpha = .85;
      if (p[4] % 2) ctx.fillRect(-p[3] * U() / 2, -p[3] * U() / 4, p[3] * U(), p[3] * U() / 2); else { ctx.beginPath(); ctx.arc(0, 0, p[3] * U() / 3, 0, 7); ctx.fill(); } ctx.restore(); }); ctx.restore(); },
    matrix: (t, c) => { fill(c.b1); ctx.save(); const fs = 28 * U(); ctx.font = `${fs}px ${MONO}`; const cols = Math.ceil(W / fs); const sp = pts('mat', cols, r => [r() * 20, r() * .8 + .5]);
      for (let i = 0; i < cols; i++) { const head = (t * sp[i][1] * 12 + sp[i][0]) % (H / fs + 20); for (let j = 0; j < 22; j++) { const y = (head - j) * fs; if (y < 0 || y > H) continue;
        ctx.fillStyle = j === 0 ? c.acc : c.txt; ctx.globalAlpha = (1 - j / 22) * .55; ctx.fillText(String.fromCharCode(0x30A0 + ((i * 7 + j * 13 + (t * 8 | 0)) % 96)), i * fs, y); } } ctx.restore(); },
    noise: (t, c) => { fill(lin(c.b1, c.b2)); },
    paper: (t, c) => { fill(c.b1); ctx.save(); pts('paper', 400, r => [r() * W, r() * H, r() * 3]).forEach(p => { ctx.fillStyle = c.b2; ctx.globalAlpha = .5; ctx.fillRect(p[0], p[1], p[2] * U() + 1, p[2] * U() + 1); }); ctx.restore(); },
    shapes: (t, c) => { fill(c.b1); ctx.save(); const u = U(); ctx.fillStyle = c.acc; ctx.beginPath(); ctx.arc(W * .2, H * .2 + Math.sin(t) * 20 * u, 160 * u, 0, 7); ctx.fill();
      ctx.fillStyle = '#1e5aa8'; ctx.save(); ctx.translate(W * .82, H * .8); ctx.rotate(t * .4); ctx.fillRect(-140 * u, -140 * u, 280 * u, 280 * u); ctx.restore();
      ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.moveTo(W * .78, H * .12); ctx.lineTo(W * .95, H * .3 + Math.sin(t) * 10); ctx.lineTo(W * .62, H * .3); ctx.fill(); ctx.restore(); },
    bars: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); const n = 48, bw = W / n; for (let i = 0; i < n; i++) { const h = (Math.abs(Math.sin(t * 3 + i * .5) * Math.sin(t * 1.7 + i * .23)) * .3 + .03) * H;
      ctx.fillStyle = c.acc; ctx.globalAlpha = .35; ctx.fillRect(i * bw + 2, H - h, bw - 4, h); ctx.globalAlpha = .15; ctx.fillRect(i * bw + 2, 0, bw - 4, h * .6); } ctx.restore(); },
    snow: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ctx.fillStyle = '#fff'; pts('snow', 160, r => [r(), r(), r() * 4 + 1, r() * 6]).forEach(p => { const y = ((p[1] * H + t * 40 * U() * p[2]) % H), x = p[0] * W + Math.sin(t + p[3]) * 25 * U();
      ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(x, y, p[2] * U() * 1.5, 0, 7); ctx.fill(); }); ctx.restore(); },
    rain: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ctx.strokeStyle = c.acc; ctx.lineWidth = 2 * U(); pts('rain', 140, r => [r(), r(), r() * .6 + .7]).forEach(p => { const y = ((p[1] * H + t * 900 * U() * p[2]) % (H + 80)) - 40, x = p[0] * W;
      ctx.globalAlpha = .35; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 * U(), y + 40 * U()); ctx.stroke(); }); ctx.restore(); },
    fog: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ctx.filter = `blur(${60 * U()}px)`; for (let k = 0; k < 5; k++) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .06; ctx.beginPath();
      ctx.ellipse(((k * .3 + t * .03 * (k + 1)) % 1.4 - .2) * W, H * (.3 + k * .15), W * .5, H * .08, 0, 0, 7); ctx.fill(); } ctx.restore(); },
    embers: (t, c) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c.b1); g.addColorStop(1, c.b2); fill(g); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      pts('emb', 120, r => [r(), r(), r() * 3 + 1, r() * 6]).forEach(p => { const y = H - ((p[1] * H + t * 120 * U() * p[2] * .5) % H), x = p[0] * W + Math.sin(t * 2 + p[3]) * 20 * U();
        ctx.fillStyle = c.acc; ctx.globalAlpha = (y / H) * .9; ctx.beginPath(); ctx.arc(x, y, p[2] * U() * 1.4, 0, 7); ctx.fill(); }); ctx.restore(); },
    pixels: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); const s = 40 * U(); for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { const v = Math.sin(x * .013 + t) * Math.cos(y * .011 - t * .8);
      if (v > .55) { ctx.fillStyle = c.acc; ctx.globalAlpha = .25; ctx.fillRect(x + 2, y + 2, s - 4, s - 4); } } ctx.restore(); },
    dunes: (t, c) => { fill(lin('#ffe8c2', c.b1)); ctx.save(); [c.b2, '#c97b3c', '#9c5a28'].forEach((col, k) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H * (.6 + k * .12) + Math.sin(x / W * (3 + k) + t * .1 * (k + 1) + k) * H * .04); ctx.lineTo(W, H); ctx.fill(); }); ctx.restore(); },
    mountains: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ['#8aa6c4', '#4f6e91', '#26405e'].forEach((col, k) => { const r = rng(k + 3); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); const off = t * 8 * (k + 1) * U();
      for (let x = -200; x <= W + 200; x += 120 * U()) ctx.lineTo(x - off % (120 * U()), H * (.55 + k * .1) - r() * H * .12); ctx.lineTo(W, H); ctx.fill(); }); ctx.restore(); },
    city: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); const r = rng(11); let x = 0; while (x < W) { const bw = (60 + r() * 120) * U(), bh = H * (.15 + r() * .35); ctx.fillStyle = '#0a0d1c'; ctx.fillRect(x, H - bh, bw, bh);
      for (let wy = H - bh + 15; wy < H - 10; wy += 26 * U()) for (let wx = x + 10; wx < x + bw - 10; wx += 22 * U()) if (r() > .55) { ctx.fillStyle = c.acc; ctx.globalAlpha = .4 + .5 * Math.abs(Math.sin(t + wx * wy)); ctx.fillRect(wx, wy, 10 * U(), 12 * U()); ctx.globalAlpha = 1; } x += bw + 6; } ctx.restore(); },
    network: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); const P = pts('net', 50, r => [r(), r(), r() * 6, r() * 6]).map(p => [p[0] * W + Math.sin(t * .5 + p[2]) * 60 * U(), p[1] * H + Math.cos(t * .4 + p[3]) * 60 * U()]);
      ctx.strokeStyle = c.acc; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d < 260 * U()) { ctx.globalAlpha = (1 - d / (260 * U())) * .4; ctx.beginPath(); ctx.moveTo(...P[i]); ctx.lineTo(...P[j]); ctx.stroke(); } }
      ctx.globalAlpha = .9; ctx.fillStyle = c.acc; P.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 5 * U(), 0, 7); ctx.fill(); }); ctx.restore(); },
    chart: (t, c) => { fill(lin(c.b1, c.b2)); ctx.save(); ctx.strokeStyle = c.acc; ctx.lineWidth = 5 * U(); ctx.globalAlpha = .35; ctx.beginPath(); const r = rng(5); let y = H * .8;
      for (let x = 0; x <= W * clamp(t / 3); x += 30 * U()) { y = clamp(y - (r() - .35) * 60 * U(), H * .2, H * .9); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      ctx.globalAlpha = .08; ctx.strokeStyle = c.txt; ctx.lineWidth = 1; for (let gy = 0; gy < H; gy += 90 * U()) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); } ctx.restore(); },
    sun: (t, c) => { fill(c.b1); ctx.save(); ctx.fillStyle = c.acc; ctx.beginPath(); ctx.arc(W / 2, H * .3, Math.min(W, H) * .22 * (1 + .02 * Math.sin(t)), 0, 7); ctx.fill(); ctx.restore(); },
    bricks: (t, c) => { fill(c.b1); ctx.save(); ctx.strokeStyle = c.b2; ctx.lineWidth = 6 * U(); const bh = 60 * U(), bw = 140 * U(); for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = (row % 2) * -bw / 2; x < W; x += bw) ctx.strokeRect(x, y, bw, bh);
      ctx.globalAlpha = .25; ctx.fillStyle = c.acc; ctx.filter = `blur(${30 * U()}px)`; ctx.beginPath(); ctx.arc(W * .3, H * .7, 200 * U(), 0, 7); ctx.fill(); ctx.fillStyle = c.txt; ctx.beginPath(); ctx.arc(W * .75, H * .3, 220 * U(), 0, 7); ctx.fill(); ctx.restore(); },
    watercolor: (t, c) => { fill(c.b1); ctx.save(); ctx.filter = `blur(${50 * U()}px)`; [[c.acc, .25, .25], ['#81b29a', .75, .7], ['#f2cc8f', .7, .2], ['#3d5a80', .2, .8]].forEach((b, i) => { ctx.globalAlpha = .35; ctx.fillStyle = b[0]; ctx.beginPath();
      ctx.arc(W * b[1], H * b[2], Math.min(W, H) * (.25 + .03 * Math.sin(t * .6 + i)), 0, 7); ctx.fill(); }); ctx.restore(); },
    kaleido: (t, c) => { fill(c.b1); ctx.save(); ctx.translate(W / 2, H / 2); const R = Math.max(W, H); for (let k = 0; k < 12; k++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = k % 2 ? c.b2 : c.acc; ctx.globalAlpha = .45; ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(R * .6, Math.sin(t) * R * .15); ctx.lineTo(R * .6 * Math.cos(t * .5), R * .3); ctx.fill(); } ctx.restore(); },
    tunnel: (t, c) => { fill(c.b1); ctx.save(); const R = Math.hypot(W, H) / 2; for (let k = 14; k >= 0; k--) { const r = ((k + (t * 1.5) % 1) / 14) * R; ctx.fillStyle = k % 2 ? c.b1 : c.acc; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, 7); ctx.fill(); } ctx.restore(); },
  };

  // ---------------------------------------------------------------- ANIMATIONS TEXTE (par lettre)
  // retourne {dx, dy, s, sx, r, a, ch, blur}; p = progression d'entrée de la lettre (0→1), t = temps scène
  const A = {
    fade: (p) => ({ a: ease.out(p) }),
    rise: (p, i, o) => ({ a: ease.out(p), dy: (1 - ease.out(p)) * o.fs * .6 }),
    slideUp: (p, i, o) => ({ a: p, dy: (1 - ease.back(p)) * o.fs * 1.5 }),
    slideDown: (p, i, o) => ({ a: p, dy: -(1 - ease.out(p)) * o.fs * 1.5 }),
    slideLeft: (p, i, o) => ({ a: p, dx: (1 - ease.out(p)) * o.fs * 3 }),
    pop: (p) => ({ a: clamp(p * 3), s: ease.back(p) }),
    bounce: (p, i, o) => ({ a: clamp(p * 4), dy: -(1 - ease.bounce(p)) * o.fs * 2 }),
    elastic: (p) => ({ a: clamp(p * 4), s: ease.elastic(p) }),
    dropIn: (p, i, o) => ({ a: clamp(p * 2), dy: -(1 - ease.bounce(p)) * o.H * .4, r: (1 - p) * .6 }),
    zoomOut: (p) => ({ a: ease.out(p), s: 1 + (1 - ease.out(p)) * 4 }),
    spin: (p) => ({ a: p, r: (1 - ease.out(p)) * Math.PI * 2, s: ease.out(p) }),
    swing: (p, i, o, t) => ({ a: clamp(p * 3), r: (1 - ease.elastic(p)) * 1.2 + Math.sin(t * 3 + i) * .05 }),
    flip: (p) => ({ a: clamp(p * 2), sx: Math.cos((1 - ease.out(p)) * Math.PI / 2) }),
    blurIn: (p) => ({ a: ease.out(p), blur: (1 - ease.out(p)) * 30, s: 1.08 - .08 * ease.out(p) }),
    typewriter: (p) => ({ a: p > 0 ? 1 : 0 }),
    wave: (p, i, o, t) => ({ a: ease.out(p), dy: Math.sin(t * 4 - i * .45) * o.fs * .12 + (1 - ease.out(p)) * o.fs }),
    jitter: (p, i, o, t) => { const f = Math.floor(t * 8); const r = rng(i * 97 + f); return { a: ease.out(p), dx: (r() - .5) * o.fs * .05, dy: (r() - .5) * o.fs * .05, r: (r() - .5) * .08 }; },
    neon: (p, i, o, t) => { const r = rng(i * 13 + Math.floor(t * 20)); const on = p >= 1 ? (r() > .03 ? 1 : .3) : (r() < p ? 1 : .1); return { a: on, glow: true }; },
    flicker: (p, i, o, t) => { const r = rng(i * 7 + Math.floor(t * 14)); return { a: p >= 1 ? .85 + r() * .15 : (r() < p ? 1 : 0) }; },
    glitch: (p, i, o, t) => { const r = rng(i * 31 + Math.floor(t * 15)); const g = r() < (p < 1 ? .5 : .06); return { a: p > 0 ? 1 : 0, dx: g ? (r() - .5) * o.fs * .6 : 0, ch: g && r() < .5 ? '#@%&$!?'[r() * 7 | 0] : null }; },
    scramble: (p, i, o, t) => { const r = rng(i * 17 + Math.floor(t * 20)); return { a: p > 0 ? 1 : .0, ch: p < 1 && p > 0 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[r() * 36 | 0] : null }; },
    stamp: (p, i, o) => ({ a: clamp(p * 5), s: 1 + (1 - ease.out(clamp(p * 1.4))) * 2.5 }),
    drawIn: (p) => ({ a: 1, draw: ease.inOut(p) }),
  };
  const STAGGER = { typewriter: .045, scramble: .03, glitch: .02, stamp: 0, zoomOut: .01, fade: .015, blurIn: .02, neon: .01, flicker: .01, drawIn: .03 };
  const DUR = { typewriter: .01, scramble: .45, stamp: .35, zoomOut: .8, bounce: .9, elastic: .9, dropIn: 1, drawIn: .9 };

  // ---------------------------------------------------------------- MISE EN PAGE
  function layout(text, fs, maxW, font, weight) {
    ctx.font = `${weight} ${fs}px ${font}`;
    const words = []; let on = false; text.split(/\s+/).filter(Boolean).forEach(w => { const st0 = w.startsWith('*'); const hl = on || st0; if (st0) on = true; if (/\*[.,!?:;]*$/.test(w) && (w.length > 1 || !st0)) on = false; words.push({ w: w.replace(/\*/g, ''), hl }); });
    const lines = []; let cur = [], cw = 0; const sp = ctx.measureText(' ').width;
    words.forEach(o => { const ww = ctx.measureText(o.w).width; if (cur.length && cw + sp + ww > maxW) { lines.push(cur); cur = []; cw = 0; } cur.push(o); cw += (cur.length > 1 ? sp : 0) + ww; });
    if (cur.length) lines.push(cur);
    return { lines, sp };
  }
  function fit(text, maxW, maxH, font, weight, base) {
    let fs = base; for (let k = 0; k < 40; k++) { const L = layout(text, fs, maxW, font, weight); const wide = L.lines.some(l => l.reduce((s, o) => s + ctx.measureText(o.w).width, 0) + L.sp * (l.length - 1) > maxW);
      if (!wide && L.lines.length * fs * 1.15 <= maxH) return { fs, ...L }; fs *= .92; } return { fs, ...layout(text, fs, maxW, font, weight) };
  }

  function drawScene(sc, lt, sd) {
    const font = FONTS[st.font], u = U(); const maxW = W * .84, maxH = H * (W > H ? .55 : .5);
    const base = (sc.size || 1) * (W > H ? 120 : 130) * u * (st.font === 'mono' ? .85 : 1);
    const L = fit(st.upper ? sc.text.toUpperCase() : sc.text, maxW, maxH, font, st.weight, base); const fs = L.fs;
    const anim = A[sc.anim || st.anim] || A.fade, stg = STAGGER[sc.anim || st.anim] ?? .035, ad = DUR[sc.anim || st.anim] ?? .6;
    // sortie
    const outT = Math.min(.35, sd * .2), outP = clamp((lt - (sd - outT)) / outT); const outA = sc.last ? 1 : 1 - ease.inOut(outP);
    // positions
    const lh = fs * 1.15, totalH = L.lines.length * lh; let y0 = H / 2 - totalH / 2 + fs * .85 + (sc.kicker ? fs * .25 : 0);
    ctx.save(); ctx.textBaseline = 'alphabetic';
    // kicker (sous-titre)
    if (sc.kicker) { const kf = Math.max(fs * .32, 26 * u); ctx.font = `600 ${kf}px ${font}`; ctx.textAlign = 'center'; ctx.fillStyle = st.c.acc; ctx.globalAlpha = clamp(lt * 3) * outA;
      ctx.letterSpacing = `${kf * .2}px`; ctx.fillText(sc.kicker.toUpperCase(), W / 2, y0 - fs * 1.05 - kf * .2); ctx.letterSpacing = '0px'; }
    ctx.font = `${st.weight} ${fs}px ${font}`; ctx.textAlign = 'left';
    let idx = 0; const total = L.lines.reduce((s, l) => s + l.reduce((a, o) => a + o.w.length, 0), 0);
    L.lines.forEach((line, li) => {
      const lw = line.reduce((s, o) => s + ctx.measureText(o.w).width, 0) + L.sp * (line.length - 1); let x = W / 2 - lw / 2; const y = y0 + li * lh;
      line.forEach(o => {
        if (o.hl && st.hlBox) { const ww = ctx.measureText(o.w).width; const firstP = clamp((lt - idx * stg) / ad); ctx.save(); ctx.globalAlpha = outA; ctx.fillStyle = st.c.acc;
          ctx.fillRect(x - fs * .08, y - fs * .82, (ww + fs * .16) * ease.out(clamp(firstP * 1.5)), fs * 1.0); ctx.restore(); }
        for (const ch of o.w) {
          const cw = ctx.measureText(ch).width; const p = clamp((lt - idx * stg) / ad);
          const tr = anim(p, idx, { fs, W, H, total }, lt); idx++;
          ctx.save(); ctx.translate(x + cw / 2 + (tr.dx || 0), y - fs * .35 + (tr.dy || 0)); ctx.rotate(tr.r || 0); const s = tr.s ?? 1; ctx.scale(s * (tr.sx ?? 1), s);
          ctx.globalAlpha = clamp((tr.a ?? 1) * outA); if (tr.blur) ctx.filter = `blur(${tr.blur * u}px)`;
          const col = o.hl ? (st.hlBox ? st.c.b1 : st.c.acc) : st.c.txt; const glyph = tr.ch || ch;
          if (st.fx.includes('glow') || tr.glow) { ctx.shadowColor = o.hl ? st.c.acc : st.c.txt; ctx.shadowBlur = fs * .35; }
          if (st.fx.includes('stroke')) { ctx.lineJoin = 'round'; ctx.lineWidth = fs * .12; ctx.strokeStyle = st.strokeCol || (st.c.txt === '#111111' || st.c.txt === '#1a1a1a' ? '#ffffff' : '#111111'); ctx.strokeText(glyph, -cw / 2, fs * .35); }
          if (tr.draw !== undefined && tr.draw < 1) { ctx.lineWidth = Math.max(2, fs * .03); ctx.strokeStyle = col; ctx.setLineDash([fs * 3 * tr.draw, fs * 3]); ctx.strokeText(glyph, -cw / 2, fs * .35); ctx.globalAlpha *= tr.draw * tr.draw; }
          if (st.fx.includes('rgb') && (st.anim === 'glitch' || sc.anim === 'glitch' || Math.sin(lt * 9 + idx) > .97)) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ff0040'; ctx.fillText(glyph, -cw / 2 - fs * .04, fs * .35); ctx.fillStyle = '#00e5ff'; ctx.fillText(glyph, -cw / 2 + fs * .04, fs * .35); ctx.globalCompositeOperation = 'source-over'; }
          ctx.fillStyle = col; ctx.fillText(glyph, -cw / 2, fs * .35); ctx.restore(); x += cw;
        }
        x += L.sp;
      });
    });
    // curseur typewriter / terminal
    if ((sc.anim || st.anim) === 'typewriter' && Math.floor(lt * 2.5) % 2 === 0) { const li = L.lines.length - 1; ctx.fillStyle = st.c.acc; ctx.globalAlpha = outA;
      const lw = L.lines[li].reduce((s, o) => s + ctx.measureText(o.w).width, 0) + L.sp * (L.lines[li].length - 1); ctx.fillRect(W / 2 + lw / 2 + fs * .08, y0 + li * lh - fs * .8, fs * .08, fs * .9); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- EFFETS
  let grainCv;
  function fx(t) {
    const f = st.fx, u = U();
    if (f.includes('vignette')) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6); g.addColorStop(0, 'transparent'); g.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (f.includes('scan') || st.bg === 'noise') { ctx.save(); ctx.fillStyle = '#000'; ctx.globalAlpha = .18; for (let y = (t * 30) % 4; y < H; y += 4 * Math.max(1, u)) ctx.fillRect(0, y, W, 1.5 * Math.max(1, u)); ctx.restore(); }
    if (f.includes('grain') || st.bg === 'noise') { if (!grainCv) { grainCv = document.createElement('canvas'); grainCv.width = 256; grainCv.height = 256; const g = grainCv.getContext('2d'); const d = g.createImageData(256, 256); const r = rng(3); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 40; } g.putImageData(d, 0, 0); }
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; const ox = (t * 977) % 256, oy = (t * 613) % 256; ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(grainCv, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore(); }
    if (f.includes('scratches')) { ctx.save(); const r = rng(Math.floor(t * 12)); ctx.strokeStyle = '#fff'; ctx.globalAlpha = .25; for (let k = 0; k < 2; k++) if (r() > .4) { const x = r() * W; ctx.lineWidth = r() * 2 + 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - .5) * 20, H); ctx.stroke(); } ctx.restore(); }
    if (f.includes('letterbox')) { ctx.fillStyle = '#000'; const b = (W > H ? H * .11 : H * .09); ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); }
    if (f.includes('border')) { ctx.save(); ctx.strokeStyle = st.c.txt; ctx.lineWidth = 14 * u; ctx.strokeRect(36 * u, 36 * u, W - 72 * u, H - 72 * u); ctx.restore(); }
  }

  // ---------------------------------------------------------------- API
  let CFG;
  window.STYLES = STYLES;
  window.setup = function (cfg) {
    CFG = cfg; W = cfg.width; H = cfg.height; cv = document.getElementById('c'); cv.width = W; cv.height = H; ctx = cv.getContext('2d'); cache = {}; grainCv = null;
    const q = String(cfg.style); st = STYLES.find(s => s.id === q || String(s.n) === q || s.name.toLowerCase() === q.toLowerCase());
    if (!st) throw new Error('Style inconnu : ' + q + ' (utilise --list)');
    st = JSON.parse(JSON.stringify(st)); Object.assign(st.c, cfg.colors || {}); st.upper = ['trailer', 'brutaliste', 'tiktok', 'sport', 'youtube', 'gaming', 'graffiti', 'suisse', 'synthwave', 'cyberpunk'].includes(st.id) || cfg.upper;
    st.hlBox = ['tiktok', 'minimal-blanc', 'minimal-noir', 'suisse', 'magazine', 'education', 'corporate', 'brutaliste'].includes(st.id);
    // timing des scènes
    let acc = 0; CFG.scenes.forEach((s, i) => { s.start = acc; s.dur = s.duration || Math.max(1.8, .9 + s.text.length * .055); acc += s.dur; s.last = i === CFG.scenes.length - 1 && !cfg.fadeOutEnd; });
    CFG.total = acc; return { total: acc, style: st.name, n: st.n };
  };
  window.frame = function (t) {
    ctx.save(); const shake = st.fx.includes('shake'); if (shake) { const r = rng(Math.floor(t * 24)); const sc = CFG.scenes.find(s => t >= s.start && t < s.start + s.dur) || CFG.scenes.at(-1); const k = clamp(1 - (t - sc.start) * 3) * 18 * U() + 2 * U(); ctx.translate((r() - .5) * k, (r() - .5) * k); }
    (BG[st.bg] || BG.solid)(t, st.c);
    const sc = CFG.scenes.find(s => t >= s.start && t < s.start + s.dur) || CFG.scenes.at(-1); drawScene(sc, t - sc.start, sc.dur);
    ctx.restore(); fx(t);
    if (CFG.watermark) { ctx.save(); ctx.font = `600 ${28 * U()}px ${SANS}`; ctx.fillStyle = st.c.txt; ctx.globalAlpha = .6; ctx.textAlign = 'center'; ctx.fillText(CFG.watermark, W / 2, H - 70 * U()); ctx.restore(); }
    return cv.toDataURL('image/jpeg', .92);
  };
})();
