/* ============================================================
   GENENGINE — pianoroll.js
   The flagship note editor. Canvas piano roll with snap down to
   1/64, draw / paint / select tools, velocity lane, slide notes,
   ghost notes, copy/paste, keyboard nudging.
   ============================================================ */
'use strict';
(function (G) {

  const V = G.views = G.views || {};

  const KEYS_W = 64, RULER_H = 26, VEL_H = 92;
  const PITCH_MAX = 119, PITCH_MIN = 12;   // B8 .. C0

  let root, canvas, ctx2d, toolbar;
  let ppt = 0.38;               // px per tick
  let keyH = 14;
  let scrollX = 0, scrollY = (PITCH_MAX - 84) * 14;  // start around C6-ish
  let snap = 24;                // 1/16 default
  let tool = 'draw';            // draw | paint | select
  let lastLen = 24, lastVel = 0.85;
  let selection = new Set();
  let clipboard = null;
  let needsDraw = true;
  let dpr = 1;

  const pat = () => G.curPattern();
  const chan = () => G.curChannel();
  const notes = () => (pat() && chan()) ? G.notesFor(pat(), chan().id) : [];

  // ---------- coordinate helpers ----------
  const gridW = () => canvas.clientWidth - KEYS_W;
  const gridH = () => canvas.clientHeight - RULER_H - VEL_H;
  const tickToX = (t) => KEYS_W + t * ppt - scrollX;
  const xToTick = (x) => (x - KEYS_W + scrollX) / ppt;
  const pitchToY = (p) => RULER_H + (PITCH_MAX - p) * keyH - scrollY;
  const yToPitch = (y) => Math.round(PITCH_MAX - (y - RULER_H + scrollY) / keyH + 0.0) | 0;
  const yToPitchF = (y) => PITCH_MAX - (y - RULER_H + scrollY) / keyH;
  const doSnap = (t, force) => (snap <= 1 && !force) ? Math.round(t) : Math.floor(t / snap) * snap;

  const clampScroll = () => {
    const maxY = (PITCH_MAX - PITCH_MIN + 1) * keyH - gridH();
    scrollY = G.clamp(scrollY, 0, Math.max(0, maxY));
    scrollX = Math.max(0, scrollX);
  };

  // ---------- drawing ----------
  const draw = () => {
    if (!canvas || !root.isConnected) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr; canvas.height = H * dpr;
    }
    const c = ctx2d;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const col = (name, fb) => (css.getPropertyValue(name) || fb).trim() || fb;
    const bg = col('--pr-bg', '#0b0e15'), rowB = col('--pr-black', '#0e1219'), rowW = col('--pr-white', '#121722');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);

    const p = pat(); const ch = chan();
    if (!p || !ch) { c.fillStyle = '#8b96a5'; c.font = '14px sans-serif'; c.fillText('Add an instrument first (Library tab)', 80, 60); return; }

    const patEnd = G.patTicks(p);
    const gh = gridH();

    // --- pitch rows ---
    c.save();
    c.beginPath(); c.rect(KEYS_W, RULER_H, W - KEYS_W, gh); c.clip();
    for (let pi = PITCH_MAX; pi >= PITCH_MIN; pi--) {
      const y = pitchToY(pi);
      if (y > RULER_H + gh || y + keyH < RULER_H) continue;
      c.fillStyle = G.isBlackKey(pi) ? rowB : rowW;
      c.fillRect(KEYS_W, y, W - KEYS_W, keyH - 1);
      if (pi % 12 === 0) {  // C rows brighter line
        c.fillStyle = 'rgba(140,160,190,0.14)';
        c.fillRect(KEYS_W, y + keyH - 1, W - KEYS_W, 1);
      }
    }

    // --- vertical grid ---
    const tStart = Math.max(0, xToTick(KEYS_W)), tEndVis = xToTick(W);
    const drawVLines = (stepTicks, color, w) => {
      c.strokeStyle = color; c.lineWidth = w; c.beginPath();
      for (let t = Math.floor(tStart / stepTicks) * stepTicks; t <= tEndVis; t += stepTicks) {
        const x = Math.round(tickToX(t)) + 0.5;
        c.moveTo(x, RULER_H); c.lineTo(x, RULER_H + gh);
      }
      c.stroke();
    };
    if (snap > 1 && snap * ppt > 5) drawVLines(snap, 'rgba(130,150,180,0.07)', 1);
    if (G.STEP * ppt > 7) drawVLines(G.STEP, 'rgba(130,150,180,0.09)', 1);
    drawVLines(G.PPQ, 'rgba(130,150,180,0.16)', 1);
    drawVLines(G.BAR, 'rgba(160,190,230,0.30)', 1);

    // beyond pattern end
    if (tickToX(patEnd) < W) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(tickToX(patEnd), RULER_H, W - tickToX(patEnd), gh);
    }

    // --- ghost notes (other channels) ---
    G.proj.channels.forEach(oc => {
      if (oc.id === ch.id || !p.notes[oc.id]) return;
      c.fillStyle = 'rgba(140,160,190,0.13)';
      p.notes[oc.id].forEach(n => {
        const x = tickToX(n.t), y = pitchToY(n.p);
        if (x > W || x + n.d * ppt < KEYS_W || y > RULER_H + gh || y < RULER_H - keyH) return;
        c.fillRect(x, y + 2, Math.max(2, n.d * ppt - 1), keyH - 5);
      });
    });

    // --- notes ---
    const hue = ch.hue;
    notes().forEach(n => {
      const x = tickToX(n.t), y = pitchToY(n.p), w = Math.max(3, n.d * ppt - 1);
      if (x > W || x + w < KEYS_W || y > RULER_H + gh || y + keyH < RULER_H) return;
      const selN = selection.has(n);
      const alpha = 0.45 + n.v * 0.5;
      c.fillStyle = `hsla(${hue},85%,${selN ? 72 : 58}%,${alpha})`;
      c.strokeStyle = selN ? '#fff' : `hsla(${hue},90%,75%,0.9)`;
      c.lineWidth = selN ? 1.6 : 1;
      roundRect(c, x, y + 1, w, keyH - 3, 3);
      c.fill(); c.stroke();
      if (n.s) {  // slide marker
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.beginPath();
        c.moveTo(x + 3, y + keyH - 4); c.lineTo(x + 9, y + keyH - 4); c.lineTo(x + 3, y + 3);
        c.closePath(); c.fill();
      }
      if (w > 34 && keyH >= 12) {
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.font = '9px "Segoe UI", sans-serif';
        c.fillText(G.noteName(n.p), x + (n.s ? 12 : 4), y + keyH - 4.5);
      }
    });

    // marquee
    if (marquee) {
      c.fillStyle = 'rgba(80,200,255,0.12)';
      c.strokeStyle = 'rgba(80,200,255,0.7)';
      c.lineWidth = 1;
      const mx = Math.min(marquee.x0, marquee.x1), my = Math.min(marquee.y0, marquee.y1);
      c.fillRect(mx, my, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0));
      c.strokeRect(mx, my, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0));
    }
    c.restore();

    // --- ruler ---
    c.fillStyle = col('--panel2', '#171c26');
    c.fillRect(KEYS_W, 0, W - KEYS_W, RULER_H);
    c.font = '10px "Segoe UI", sans-serif';
    for (let t = Math.floor(tStart / G.BAR) * G.BAR; t <= tEndVis; t += G.BAR) {
      const x = tickToX(t);
      c.fillStyle = 'rgba(160,190,230,0.5)';
      c.fillRect(x, 0, 1, RULER_H);
      c.fillStyle = '#9fb4cc';
      c.fillText(String(t / G.BAR + 1), x + 4, 16);
    }

    // --- velocity lane ---
    const vy = H - VEL_H;
    c.fillStyle = col('--panel', '#11151d');
    c.fillRect(0, vy, W, VEL_H);
    c.fillStyle = 'rgba(140,160,190,0.25)';
    c.fillRect(0, vy, W, 1);
    c.fillStyle = '#8b96a5'; c.font = '9px sans-serif';
    c.fillText('VELOCITY', 8, vy + 12);
    c.save();
    c.beginPath(); c.rect(KEYS_W, vy, W - KEYS_W, VEL_H); c.clip();
    notes().forEach(n => {
      const x = tickToX(n.t);
      if (x > W || x < KEYS_W - 10) return;
      const h = n.v * (VEL_H - 14);
      const selN = selection.has(n);
      c.fillStyle = `hsla(${hue},85%,${selN ? 75 : 55}%,0.85)`;
      c.fillRect(x, vy + VEL_H - h - 4, Math.max(3, Math.min(n.d * ppt - 1, 9)), h);
    });
    c.restore();

    // --- keys gutter ---
    c.fillStyle = col('--panel2', '#171c26');
    c.fillRect(0, 0, KEYS_W, H - VEL_H);
    c.save();
    c.beginPath(); c.rect(0, RULER_H, KEYS_W, gh); c.clip();
    for (let pi = PITCH_MAX; pi >= PITCH_MIN; pi--) {
      const y = pitchToY(pi);
      if (y > RULER_H + gh || y + keyH < RULER_H) continue;
      const black = G.isBlackKey(pi);
      c.fillStyle = black ? '#1a2029' : '#e8edf4';
      c.fillRect(0, y, KEYS_W - 6, keyH - 1);
      if (pi % 12 === 0) {
        c.fillStyle = black ? '#aaa' : '#333';
        c.font = 'bold 9px "Segoe UI", sans-serif';
        c.fillText(G.noteName(pi), 4, y + keyH - 3.5);
      }
    }
    c.restore();

    // --- playhead ---
    if (G.transport.playing && G.transport.mode === 'pat') {
      const t = G.transport.posTicks() % patEnd;
      const x = tickToX(t);
      if (x >= KEYS_W && x <= W) {
        c.fillStyle = 'rgba(90,255,220,0.9)';
        c.fillRect(x, 0, 1.5, H - VEL_H);
      }
    }

    needsDraw = false;
  };

  const roundRect = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  const invalidate = () => { needsDraw = true; };

  // ---------- hit testing ----------
  const noteAt = (x, y) => {
    const arr = notes();
    for (let i = arr.length - 1; i >= 0; i--) {
      const n = arr[i];
      const nx = tickToX(n.t), ny = pitchToY(n.p), w = Math.max(4, n.d * ppt);
      if (x >= nx - 1 && x <= nx + w + 1 && y >= ny && y <= ny + keyH) return n;
    }
    return null;
  };
  const nearRightEdge = (n, x) => {
    const nx = tickToX(n.t), w = Math.max(4, n.d * ppt);
    return x > nx + w - Math.min(8, w * 0.4);
  };

  // ---------- interactions ----------
  let marquee = null;
  let dragCtx = null;

  const onPointerDown = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    canvas.setPointerCapture(e.pointerId);

    // middle drag = pan
    if (e.button === 1) {
      dragCtx = { kind: 'pan', sx: scrollX, sy: scrollY };
      e.preventDefault();
      return;
    }

    // keys gutter: audition
    if (x < KEYS_W && y > RULER_H && y < canvas.clientHeight - VEL_H) {
      const p = yToPitch(y + keyH / 2 - keyH / 2);
      if (chan()) { G.audio.init().then(() => G.audio.previewNote(chan(), p, 0.35)); }
      dragCtx = { kind: 'keys', last: p };
      return;
    }

    // velocity lane
    if (y > canvas.clientHeight - VEL_H) {
      dragCtx = { kind: 'vel', snap: G.undoCapture() };
      applyVelAt(x, y, e);
      return;
    }

    if (y < RULER_H) return;

    const n = noteAt(x, y);

    if (e.button === 2) {
      // erase
      if (n) { G.undoPush('Delete note'); removeNote(n); }
      dragCtx = { kind: 'erase' };
      return;
    }

    if (tool === 'select' || e.shiftKey && !n) {
      dragCtx = { kind: 'marquee' };
      marquee = { x0: x, y0: y, x1: x, y1: y, add: e.shiftKey };
      invalidate();
      return;
    }

    if (n) {
      // select + move/resize
      if (!selection.has(n)) {
        if (!e.shiftKey) selection.clear();
        selection.add(n);
      } else if (e.shiftKey) {
        selection.delete(n); invalidate(); return;
      }
      const resize = nearRightEdge(n, x);
      dragCtx = {
        kind: resize ? 'resize' : 'move',
        ref: n, snap: G.undoCapture(),
        orig: new Map([...selection].map(m => [m, { t: m.t, p: m.p, d: m.d }])),
        startTick: xToTick(x), startPitch: yToPitchF(y),
        moved: false,
      };
      invalidate();
      return;
    }

    // empty space: create (draw / paint)
    if (tool === 'draw' || tool === 'paint') {
      G.undoPush('Add note');
      const t = doSnap(xToTick(x)), p = G.clamp(yToPitch(y), PITCH_MIN, PITCH_MAX);
      if (t < 0) return;
      const nn = { t, d: lastLen, p, v: lastVel };
      notes().push(nn);
      selection.clear(); selection.add(nn);
      chan()._stepPitch = p;
      G.audio.init().then(() => G.audio.previewNote(chan(), p, 0.25));
      if (tool === 'draw') {
        dragCtx = {
          kind: 'move', ref: nn, creating: true,
          orig: new Map([[nn, { t: nn.t, p: nn.p, d: nn.d }]]),
          startTick: xToTick(x), startPitch: yToPitchF(y), moved: false,
        };
      } else {
        dragCtx = { kind: 'paint', pitch: p, painted: new Set([t]) };
      }
      invalidate();
    }
  };

  const onPointerMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;

    if (!dragCtx) {
      // hover cursor
      if (x > KEYS_W && y > RULER_H && y < canvas.clientHeight - VEL_H) {
        const n = noteAt(x, y);
        canvas.style.cursor = n ? (nearRightEdge(n, x) ? 'ew-resize' : 'grab') : 'crosshair';
      } else canvas.style.cursor = 'default';
      return;
    }

    switch (dragCtx.kind) {
      case 'pan':
        scrollX = Math.max(0, scrollX - e.movementX);
        scrollY += -e.movementY;
        clampScroll();
        invalidate();
        break;
      case 'keys': {
        const p = yToPitch(y);
        if (p !== dragCtx.last) { dragCtx.last = p; G.audio.previewNote(chan(), p, 0.3); }
        break;
      }
      case 'vel': applyVelAt(x, y, e); break;
      case 'erase': {
        const n = noteAt(x, y);
        if (n) removeNote(n);
        break;
      }
      case 'marquee':
        marquee.x1 = x; marquee.y1 = y;
        invalidate();
        break;
      case 'move': {
        const dtick = snap > 1 ? Math.round((xToTick(x) - dragCtx.startTick) / snap) * snap : Math.round(xToTick(x) - dragCtx.startTick);
        const dp = Math.round(yToPitchF(y) - dragCtx.startPitch);
        let blocked = false;
        dragCtx.orig.forEach((o) => { if (o.t + dtick < 0) blocked = true; });
        dragCtx.orig.forEach((o, m) => {
          m.t = Math.max(0, o.t + (blocked ? 0 : dtick));
          m.p = G.clamp(o.p + dp, PITCH_MIN, PITCH_MAX);
        });
        if (dtick || dp) dragCtx.moved = true;
        if (dp && dragCtx.ref) {
          if (dragCtx._lastPrev !== dragCtx.ref.p) {
            dragCtx._lastPrev = dragCtx.ref.p;
            G.audio.previewNote(chan(), dragCtx.ref.p, 0.15);
          }
        }
        invalidate();
        break;
      }
      case 'resize': {
        const endT = xToTick(x);
        dragCtx.orig.forEach((o, m) => {
          let d = snap > 1 ? Math.max(snap, Math.ceil((endT - o.t) / snap) * snap) : Math.max(2, Math.round(endT - o.t));
          m.d = d;
        });
        lastLen = dragCtx.ref.d;
        dragCtx.moved = true;
        invalidate();
        break;
      }
      case 'paint': {
        const t = doSnap(xToTick(x));
        const p = G.clamp(yToPitch(y), PITCH_MIN, PITCH_MAX);
        if (t >= 0 && !dragCtx.painted.has(t + ':' + p) && !noteAt(x, y)) {
          dragCtx.painted.add(t + ':' + p);
          notes().push({ t, d: Math.min(lastLen, snap > 1 ? snap : lastLen), p, v: lastVel });
          invalidate();
        }
        break;
      }
    }
  };

  const onPointerUp = (e) => {
    if (!dragCtx) return;
    if (dragCtx.kind === 'marquee' && marquee) {
      const t0 = xToTick(Math.min(marquee.x0, marquee.x1)), t1 = xToTick(Math.max(marquee.x0, marquee.x1));
      const pTop = yToPitchF(Math.min(marquee.y0, marquee.y1)), pBot = yToPitchF(Math.max(marquee.y0, marquee.y1));
      if (!marquee.add) selection.clear();
      notes().forEach(n => {
        if (n.t + n.d > t0 && n.t < t1 && n.p <= pTop + 0.5 && n.p >= pBot - 0.5) selection.add(n);
      });
      marquee = null;
      invalidate();
    }
    if (dragCtx.kind === 'move' || dragCtx.kind === 'resize') {
      if (dragCtx.snap && dragCtx.moved && !dragCtx.creating) G.undoCommit(dragCtx.kind === 'resize' ? 'Resize notes' : 'Move notes', dragCtx.snap);
      G.patAutoGrow(pat());
      G.emit('notes-silent');
    }
    if (dragCtx.kind === 'paint' || dragCtx.kind === 'erase' || dragCtx.kind === 'vel') {
      if (dragCtx.kind === 'vel' && dragCtx.snap) G.undoCommit('Velocity', dragCtx.snap);
      G.patAutoGrow(pat());
      G.emit('notes-silent');
    }
    dragCtx = null;
    invalidate();
  };

  const applyVelAt = (x, y, e) => {
    const H = canvas.clientHeight;
    const v = G.clamp(1 - (y - (H - VEL_H) - 4) / (VEL_H - 14), 0.02, 1);
    const t = xToTick(x);
    let targets;
    if (selection.size > 1) targets = [...selection];
    else {
      // nearest note whose start is within half a step of cursor x
      targets = notes().filter(n => Math.abs(n.t - t) < G.STEP);
      targets.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t));
      targets = targets.slice(0, 1);
    }
    targets.forEach(n => { n.v = v; lastVel = v; });
    invalidate();
  };

  const removeNote = (n) => {
    const arr = notes();
    const i = arr.indexOf(n);
    if (i >= 0) arr.splice(i, 1);
    selection.delete(n);
    invalidate();
  };

  // ---------- clipboard / keyboard ----------
  const copySel = () => {
    if (!selection.size) return;
    const minT = Math.min(...[...selection].map(n => n.t));
    clipboard = [...selection].map(n => ({ t: n.t - minT, d: n.d, p: n.p, v: n.v, s: n.s }));
    G.toast('Copied ' + clipboard.length + ' notes');
  };
  const paste = () => {
    if (!clipboard || !clipboard.length) return;
    G.undoPush('Paste');
    const at = 0;
    const arr = notes();
    selection.clear();
    clipboard.forEach(n => {
      const nn = Object.assign({}, n); nn.t += at;
      arr.push(nn); selection.add(nn);
    });
    G.patAutoGrow(pat());
    invalidate(); G.emit('notes-silent');
  };
  const duplicateSel = () => {
    const src = selection.size ? [...selection] : notes();
    if (!src.length) return;
    G.undoPush('Duplicate');
    const minT = Math.min(...src.map(n => n.t));
    const maxT = Math.max(...src.map(n => n.t + n.d));
    let span = maxT - minT;
    span = Math.max(snap > 1 ? snap : G.STEP, Math.ceil(span / G.BAR) * G.BAR >= span && span > G.BAR / 2 ? Math.ceil(span / G.BAR) * G.BAR : span);
    const arr = notes();
    selection.clear();
    src.forEach(n => {
      const nn = { t: n.t + span, d: n.d, p: n.p, v: n.v, s: n.s };
      arr.push(nn); selection.add(nn);
    });
    G.patAutoGrow(pat());
    invalidate(); G.emit('notes-silent');
  };

  const handleKey = (e) => {
    if (G.sel.tab !== 'piano') return false;
    const k = e.key.toLowerCase();
    const arr = notes();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'a') { e.preventDefault(); selection = new Set(arr); invalidate(); return true; }
      if (k === 'c') { e.preventDefault(); copySel(); return true; }
      if (k === 'x') { e.preventDefault(); copySel(); G.undoPush('Cut'); [...selection].forEach(removeNote); G.emit('notes-silent'); return true; }
      if (k === 'v') { e.preventDefault(); paste(); return true; }
      if (k === 'b') { e.preventDefault(); duplicateSel(); return true; }
      return false;
    }
    if (k === 'delete' || k === 'backspace') {
      if (selection.size) { G.undoPush('Delete notes'); [...selection].forEach(removeNote); G.emit('notes-silent'); }
      return true;
    }
    if (k === 's' && selection.size) {
      G.undoPush('Toggle slide');
      const to = ![...selection][0].s;
      selection.forEach(n => n.s = to);
      invalidate();
      return true;
    }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) && selection.size) {
      e.preventDefault();
      G.undoPush('Nudge');
      const dtick = k === 'arrowleft' ? -(snap > 1 ? snap : 6) : k === 'arrowright' ? (snap > 1 ? snap : 6) : 0;
      const dp = k === 'arrowup' ? (e.shiftKey ? 12 : 1) : k === 'arrowdown' ? (e.shiftKey ? -12 : -1) : 0;
      selection.forEach(n => { n.t = Math.max(0, n.t + dtick); n.p = G.clamp(n.p + dp, PITCH_MIN, PITCH_MAX); });
      G.patAutoGrow(pat());
      invalidate(); G.emit('notes-silent');
      return true;
    }
    return false;
  };

  // ---------- toolbar ----------
  const buildToolbar = () => {
    toolbar.innerHTML = '';
    const chanSel = G.el('div', 'pr-chan', toolbar);
    const dot = G.el('span', 'pr-chan-dot', chanSel);
    const nm = G.el('span', '', chanSel, chan() ? chan().name : '—');
    if (chan()) dot.style.background = `hsl(${chan().hue},85%,60%)`;
    chanSel.title = 'Switch channel';
    chanSel.addEventListener('click', (e) => {
      G.menu(e.clientX, e.clientY + 10, G.proj.channels.map(c => ({
        label: (c.id === G.sel.channelId ? '● ' : '○ ') + c.name,
        action: () => { G.sel.channelId = c.id; G.emit('channels'); refresh(); },
      })));
    });

    const tools = [['draw', '✏️ Draw'], ['paint', '🖌 Paint'], ['select', '⬚ Select']];
    const tg = G.el('div', 'seg', toolbar);
    tools.forEach(([id, label]) => {
      const b = G.el('button', 'seg-btn' + (tool === id ? ' active' : ''), tg, label);
      b.addEventListener('click', () => { tool = id; buildToolbar(); });
    });

    G.el('span', 'dim pad-l', toolbar, 'SNAP');
    toolbar.appendChild(G.select(G.SNAPS.map(s => [String(s[1]), s[0]]), String(snap), v => { snap = parseInt(v, 10); invalidate(); }));

    const zoomOut = G.el('button', 'mini-btn', toolbar, '−');
    G.el('span', 'dim', toolbar, 'zoom');
    const zoomIn = G.el('button', 'mini-btn', toolbar, '+');
    zoomOut.addEventListener('click', () => { ppt = Math.max(0.08, ppt / 1.3); invalidate(); });
    zoomIn.addEventListener('click', () => { ppt = Math.min(3, ppt * 1.3); invalidate(); });

    const hint = G.el('span', 'pr-hint', toolbar,
      'Left: draw & drag · Edge: resize · Right: erase · Shift+drag: select · S: slide · Ctrl+B: duplicate · Wheel: scroll · Ctrl+Wheel: zoom');
  };

  // ---------- mounting ----------
  const refresh = () => { if (root) { buildToolbar(); invalidate(); } };

  V.piano = {
    mount(el) {
      root = el;
      root.innerHTML = '';
      toolbar = G.el('div', 'pr-toolbar', root);
      const cwrap = G.el('div', 'pr-canvas-wrap', root);
      canvas = G.el('canvas', 'pr-canvas', cwrap);
      ctx2d = canvas.getContext('2d');
      dpr = window.devicePixelRatio || 1;

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const r = canvas.getBoundingClientRect();
          const mx = e.clientX - r.left;
          const tickAt = xToTick(mx);
          ppt = G.clamp(ppt * (e.deltaY < 0 ? 1.12 : 0.89), 0.06, 3);
          scrollX = Math.max(0, tickAt * ppt - (mx - KEYS_W));
        } else if (e.shiftKey) {
          scrollX = Math.max(0, scrollX + (e.deltaY + e.deltaX) * 0.9);
        } else {
          scrollY += e.deltaY * 0.6;
        }
        clampScroll();
        invalidate();
      }, { passive: false });

      buildToolbar();
      scrollToContent();
      invalidate();
    },
    refresh,
    handleKey,
    tick() { if (G.transport.playing || needsDraw) draw(); },
    invalidate,
  };

  const scrollToContent = () => {
    const arr = notes();
    if (arr.length) {
      const avg = arr.reduce((s, n) => s + n.p, 0) / arr.length;
      scrollY = (PITCH_MAX - avg) * keyH - 200;
    } else {
      scrollY = (PITCH_MAX - 72) * keyH - 160;
    }
    scrollX = 0;
    clampScroll();
  };

  ['notes', 'patterns', 'channels', 'project'].forEach(evt => G.on(evt, () => {
    selection = new Set([...selection].filter(n => notes().includes(n)));
    if (G.sel.tab === 'piano') refresh();
  }));

})(window.G);
