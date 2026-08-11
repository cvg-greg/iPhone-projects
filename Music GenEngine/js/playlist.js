/* ============================================================
   GENENGINE — playlist.js
   Song arrangement: paint pattern clips & automation clips onto
   tracks, loop region, seek, automation curve editor.
   ============================================================ */
'use strict';
(function (G) {

  const V = G.views = G.views || {};

  const HEAD_W = 118, RULER_H = 28, TRACK_H = 42;

  let root, canvas, ctx2d, toolbar;
  let ppt = 0.16;
  let scrollX = 0, scrollY = 0;
  let snapTicks = G.BAR;
  let brush = { type: 'pat', id: null };
  let dragCtx = null;
  let needsDraw = true;
  let dpr = 1;

  const proj = () => G.proj;
  const tracks = () => G.proj.playlist.tracks;

  const tickToX = (t) => HEAD_W + t * ppt - scrollX;
  const xToTick = (x) => (x - HEAD_W + scrollX) / ppt;
  const trackToY = (i) => RULER_H + i * TRACK_H - scrollY;
  const yToTrack = (y) => Math.floor((y - RULER_H + scrollY) / TRACK_H);
  const doSnap = (t) => Math.max(0, Math.floor(t / snapTicks) * snapTicks);

  const brushLen = () => {
    if (brush.type === 'pat') {
      const p = G.patById(brush.id) || G.proj.patterns[0];
      return p ? G.patTicks(p) : G.BAR;
    }
    return G.BAR * 4;
  };

  const ensureBrush = () => {
    if (brush.type === 'pat' && !G.patById(brush.id)) brush.id = G.proj.patterns[0] && G.proj.patterns[0].id;
    if (brush.type === 'auto' && !G.autoById(brush.id)) { brush = { type: 'pat', id: G.proj.patterns[0] && G.proj.patterns[0].id }; }
  };

  // ---------- drawing ----------
  const draw = () => {
    if (!canvas || !root.isConnected) return;
    ensureBrush();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const c = ctx2d;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0b0e15'; c.fillRect(0, 0, W, H);

    const trs = tracks();
    const tStart = Math.max(0, xToTick(HEAD_W)), tEnd = xToTick(W);

    // track row backgrounds
    for (let i = 0; i < trs.length; i++) {
      const y = trackToY(i);
      if (y > H || y + TRACK_H < RULER_H) continue;
      c.fillStyle = i % 2 ? '#0d1119' : '#0f131c';
      c.fillRect(HEAD_W, y, W - HEAD_W, TRACK_H - 2);
    }

    // grid lines
    c.strokeStyle = 'rgba(130,150,180,0.10)'; c.lineWidth = 1; c.beginPath();
    for (let t = Math.floor(tStart / G.BAR) * G.BAR; t <= tEnd; t += G.BAR) {
      const x = Math.round(tickToX(t)) + 0.5;
      c.moveTo(x, RULER_H); c.lineTo(x, H);
    }
    c.stroke();
    c.strokeStyle = 'rgba(160,190,230,0.22)'; c.beginPath();
    for (let t = Math.floor(tStart / (G.BAR * 4)) * G.BAR * 4; t <= tEnd; t += G.BAR * 4) {
      const x = Math.round(tickToX(t)) + 0.5;
      c.moveTo(x, RULER_H); c.lineTo(x, H);
    }
    c.stroke();

    // clips
    trs.forEach((tr, ti) => {
      const y = trackToY(ti);
      if (y > H || y + TRACK_H < RULER_H) return;
      tr.clips.forEach(clip => {
        const x = tickToX(clip.t), w = clip.d * ppt;
        if (x > W || x + w < HEAD_W) return;
        if (clip.type === 'pat') {
          const p = G.patById(clip.patId);
          if (!p) return;
          const hue = p.hue;
          c.fillStyle = `hsla(${hue},70%,45%,0.55)`;
          c.strokeStyle = `hsla(${hue},85%,65%,0.95)`;
          c.lineWidth = 1;
          c.fillRect(x, y + 1, w - 1, TRACK_H - 5);
          c.strokeRect(x + 0.5, y + 1.5, w - 2, TRACK_H - 6);
          // mini note preview
          const patLen = G.patTicks(p);
          c.fillStyle = `hsla(${hue},90%,78%,0.9)`;
          let lo = 127, hi = 0, any = false;
          Object.values(p.notes).forEach(arr => arr.forEach(n => { any = true; lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }));
          if (any) {
            const span = Math.max(6, hi - lo + 1);
            Object.values(p.notes).forEach(arr => arr.forEach(n => {
              for (let rep = 0; rep * patLen < clip.d; rep++) {
                const nx = x + (rep * patLen + n.t) * ppt;
                if (rep * patLen + n.t >= clip.d) break;
                const ny = y + 4 + (1 - (n.p - lo) / span) * (TRACK_H - 16);
                c.fillRect(nx, ny, Math.max(1.5, n.d * ppt * 0.8), 2);
              }
            }));
          }
          // repeat separators
          for (let rep = 1; rep * patLen < clip.d; rep++) {
            const rx = x + rep * patLen * ppt;
            c.fillStyle = `hsla(${hue},60%,25%,0.8)`;
            c.fillRect(rx, y + 1, 1, TRACK_H - 5);
            c.fillStyle = `hsla(${hue},90%,78%,0.9)`;
          }
          c.fillStyle = 'rgba(255,255,255,0.92)';
          c.font = 'bold 10px "Segoe UI", sans-serif';
          c.fillText(p.name, x + 5, y + 13, Math.max(10, w - 10));
        } else {
          const a = G.autoById(clip.autoId);
          c.fillStyle = 'hsla(265,70%,50%,0.35)';
          c.strokeStyle = 'hsla(265,90%,70%,0.95)';
          c.fillRect(x, y + 1, w - 1, TRACK_H - 5);
          c.strokeRect(x + 0.5, y + 1.5, w - 2, TRACK_H - 6);
          if (a) {
            c.beginPath();
            c.lineWidth = 1.6;
            a.points.forEach((pt, i2) => {
              const px = x + pt.t * clip.d * ppt;
              const py = y + 3 + (1 - pt.v) * (TRACK_H - 12);
              i2 ? c.lineTo(px, py) : c.moveTo(px, py);
            });
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.92)';
            c.font = 'bold 10px "Segoe UI", sans-serif';
            c.fillText('⚙ ' + a.name, x + 5, y + 13, Math.max(10, w - 10));
          }
        }
      });
    });

    // ruler
    c.fillStyle = '#171c26'; c.fillRect(HEAD_W, 0, W - HEAD_W, RULER_H);
    // loop region
    if (proj().loop.on) {
      const lx = tickToX(proj().loop.a), lx2 = tickToX(proj().loop.b);
      c.fillStyle = 'rgba(56,220,255,0.18)';
      c.fillRect(lx, 0, lx2 - lx, RULER_H);
      c.fillStyle = 'rgba(56,220,255,0.8)';
      c.fillRect(lx, 0, 2, RULER_H); c.fillRect(lx2 - 2, 0, 2, RULER_H);
    }
    c.font = '10px "Segoe UI", sans-serif';
    for (let t = Math.floor(tStart / G.BAR) * G.BAR; t <= tEnd; t += G.BAR) {
      const bar = t / G.BAR + 1;
      const x = tickToX(t);
      c.fillStyle = 'rgba(160,190,230,0.5)';
      c.fillRect(x, bar % 4 === 1 ? 4 : 14, 1, RULER_H);
      if (bar % 4 === 1 || ppt > 0.3) {
        c.fillStyle = '#9fb4cc';
        c.fillText(String(bar), x + 4, 12);
      }
    }

    // headers
    c.fillStyle = '#12161f'; c.fillRect(0, 0, HEAD_W, H);
    c.fillStyle = '#171c26'; c.fillRect(0, 0, HEAD_W, RULER_H);
    c.fillStyle = '#8b96a5'; c.font = 'bold 9px "Segoe UI", sans-serif';
    c.fillText('TRACKS', 10, 17);
    trs.forEach((tr, i) => {
      const y = trackToY(i);
      if (y > H || y + TRACK_H < RULER_H) return;
      c.fillStyle = '#141924';
      c.fillRect(0, y, HEAD_W - 4, TRACK_H - 2);
      c.fillStyle = '#cfd8e3'; c.font = '11px "Segoe UI", sans-serif';
      c.fillText(tr.name, 10, y + 24, HEAD_W - 20);
    });

    // playhead
    if (G.transport.playing && G.transport.mode === 'song') {
      const x = tickToX(G.transport.posTicks());
      if (x >= HEAD_W && x <= W) {
        c.fillStyle = 'rgba(90,255,220,0.9)';
        c.fillRect(x, 0, 1.5, H);
      }
    } else if (V.playlist._seek != null) {
      const x = tickToX(V.playlist._seek);
      c.fillStyle = 'rgba(90,255,220,0.5)';
      c.fillRect(x, 0, 1.5, H);
    }

    needsDraw = false;
  };

  const invalidate = () => { needsDraw = true; };

  // ---------- hit testing ----------
  const clipAt = (x, y) => {
    const ti = yToTrack(y);
    if (ti < 0 || ti >= tracks().length) return null;
    const t = xToTick(x);
    const tr = tracks()[ti];
    for (let i = tr.clips.length - 1; i >= 0; i--) {
      const clip = tr.clips[i];
      if (t >= clip.t && t < clip.t + clip.d) return { clip, track: ti };
    }
    return null;
  };

  // ---------- interactions ----------
  const onPointerDown = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    canvas.setPointerCapture(e.pointerId);

    if (e.button === 1) { dragCtx = { kind: 'pan' }; e.preventDefault(); return; }

    // ruler: seek / loop drag
    if (y < RULER_H && x > HEAD_W) {
      const t = doSnap(xToTick(x));
      if (e.button === 2 || e.shiftKey) {
        dragCtx = { kind: 'loop', a: t };
        proj().loop.on = true; proj().loop.a = t; proj().loop.b = t + G.BAR;
      } else {
        dragCtx = { kind: 'seek' };
        seekTo(t);
      }
      invalidate();
      return;
    }

    // headers: rename on dblclick handled separately
    if (x < HEAD_W) return;

    const hit = clipAt(x, y);

    if (e.button === 2) {
      if (hit) {
        G.undoPush('Delete clip');
        const tr = tracks()[hit.track];
        tr.clips = tr.clips.filter(cl => cl !== hit.clip);
        invalidate(); G.emit('playlist-silent');
      }
      dragCtx = { kind: 'erase' };
      return;
    }

    if (hit) {
      const edgeX = tickToX(hit.clip.t + hit.clip.d);
      const resize = edgeX - x < 10;
      G.undoPush(resize ? 'Resize clip' : 'Move clip');
      dragCtx = {
        kind: resize ? 'resize' : 'move',
        clip: hit.clip, fromTrack: hit.track,
        grabOfs: xToTick(x) - hit.clip.t,
        origT: hit.clip.t,
      };
      return;
    }

    // paint new clip
    const ti = yToTrack(y);
    if (ti < 0 || ti >= tracks().length) return;
    ensureBrush();
    if (!brush.id) return;
    G.undoPush('Paint clip');
    const t = doSnap(xToTick(x));
    const clip = brush.type === 'pat'
      ? { id: G.uid(), type: 'pat', patId: brush.id, t, d: brushLen() }
      : { id: G.uid(), type: 'auto', autoId: brush.id, t, d: brushLen() };
    tracks()[ti].clips.push(clip);
    dragCtx = { kind: 'resize', clip, fromTrack: ti, creating: true, minD: brushLen() };
    invalidate();
  };

  const onPointerMove = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;

    if (!dragCtx) {
      const hit = x > HEAD_W && y > RULER_H ? clipAt(x, y) : null;
      canvas.style.cursor = hit
        ? (tickToX(hit.clip.t + hit.clip.d) - x < 10 ? 'ew-resize' : 'grab')
        : (y < RULER_H && x > HEAD_W ? 'pointer' : 'crosshair');
      return;
    }

    switch (dragCtx.kind) {
      case 'pan':
        scrollX = Math.max(0, scrollX - e.movementX);
        scrollY = Math.max(0, scrollY - e.movementY);
        invalidate();
        break;
      case 'seek':
        seekTo(doSnap(xToTick(x)));
        break;
      case 'loop': {
        const t = doSnap(xToTick(x)) + snapTicks;
        proj().loop.b = Math.max(dragCtx.a + snapTicks, t);
        invalidate();
        break;
      }
      case 'erase': {
        const hit = clipAt(x, y);
        if (hit) {
          const tr = tracks()[hit.track];
          tr.clips = tr.clips.filter(cl => cl !== hit.clip);
          invalidate();
        }
        break;
      }
      case 'move': {
        const t = doSnap(xToTick(x) - dragCtx.grabOfs + snapTicks / 2);
        dragCtx.clip.t = Math.max(0, t);
        const ti = G.clamp(yToTrack(y), 0, tracks().length - 1);
        if (ti !== dragCtx.fromTrack) {
          const from = tracks()[dragCtx.fromTrack];
          from.clips = from.clips.filter(cl => cl !== dragCtx.clip);
          tracks()[ti].clips.push(dragCtx.clip);
          dragCtx.fromTrack = ti;
        }
        invalidate();
        break;
      }
      case 'resize': {
        const t = xToTick(x);
        let d = Math.max(snapTicks, Math.ceil((t - dragCtx.clip.t) / snapTicks) * snapTicks);
        if (dragCtx.creating && dragCtx.minD) d = Math.max(d, 0) || dragCtx.minD;
        dragCtx.clip.d = d;
        invalidate();
        break;
      }
    }
  };

  const onPointerUp = () => {
    if (!dragCtx) return;
    if (['move', 'resize', 'erase', 'loop'].includes(dragCtx.kind)) G.emit('playlist-silent');
    dragCtx = null;
  };

  const onDblClick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < HEAD_W && y > RULER_H) {
      const ti = yToTrack(y);
      if (ti >= 0 && ti < tracks().length) renameTrack(tracks()[ti]);
      return;
    }
    const hit = clipAt(x, y);
    if (!hit) return;
    if (hit.clip.type === 'pat') {
      G.sel.patternId = hit.clip.patId;
      G.setTab('steps');
    } else {
      const a = G.autoById(hit.clip.autoId);
      if (a) V.playlist.editAutomation(a);
    }
  };

  const seekTo = (t) => {
    V.playlist._seek = Math.max(0, t);
    G.transport.startFrom = V.playlist._seek;
    if (G.transport.playing && G.transport.mode === 'song') {
      G.transport.start(V.playlist._seek);
    }
    invalidate();
  };

  const renameTrack = (tr) => {
    G.modal('Rename track', (body, close) => {
      const inp = G.el('input', 'ginput', body); inp.value = tr.name;
      const b = G.el('button', 'btn glow', body, 'Save');
      const doIt = () => { tr.name = inp.value || tr.name; close(); invalidate(); };
      b.addEventListener('click', doIt);
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') doIt(); });
      setTimeout(() => inp.select(), 50);
    });
  };

  // ---------- automation ----------
  const autoTargetList = () => {
    const out = [{ v: JSON.stringify({ ch: 'master', param: 'vol' }), l: '★ Master Volume' }];
    G.proj.channels.forEach(ch => {
      [['vol', 'Volume'], ['pan', 'Pan'], ['pitch', 'Pitch ±24st'], ['sendA', 'Reverb Send'], ['sendB', 'Delay Send']].forEach(([p, l]) => {
        out.push({ v: JSON.stringify({ ch: ch.id, param: p }), l: ch.name + ' · ' + l });
      });
      ch.fx.forEach(f => {
        if (f.type === 'filter') {
          out.push({ v: JSON.stringify({ ch: ch.id, param: 'fx:' + f.id + ':cutoff' }), l: ch.name + ' · Filter Cutoff' });
          out.push({ v: JSON.stringify({ ch: ch.id, param: 'fx:' + f.id + ':res' }), l: ch.name + ' · Filter Reso' });
        }
      });
    });
    return out;
  };

  const newAutomation = () => {
    G.undoPush('New automation');
    const a = {
      id: G.uid(), name: 'Automation ' + (G.proj.automations.length + 1),
      target: { ch: 'master', param: 'vol' },
      points: [{ t: 0, v: 0.3 }, { t: 1, v: 0.8 }],
    };
    G.proj.automations.push(a);
    brush = { type: 'auto', id: a.id };
    buildToolbar();
    V.playlist.editAutomation(a);
  };

  V.playlist = V.playlist || {};
  V.playlist.editAutomation = (a) => {
    G.modal('⚙ ' + a.name, (body, close) => {
      const row = G.el('div', 'auto-row', body);
      G.el('span', 'dim', row, 'Name');
      const nameInp = G.el('input', 'ginput slim', row);
      nameInp.value = a.name;
      nameInp.addEventListener('change', () => { a.name = nameInp.value; invalidate(); });
      G.el('span', 'dim pad-l', row, 'Target');
      const targets = autoTargetList();
      const sel = G.select(targets.map(t => [t.v, t.l]), JSON.stringify(a.target), v => { a.target = JSON.parse(v); });
      if (![...sel.options].some(o => o.value === JSON.stringify(a.target))) sel.selectedIndex = 0;
      row.appendChild(sel);

      const cv = G.el('canvas', 'auto-canvas', body);
      cv.width = 660; cv.height = 240;
      const c2 = cv.getContext('2d');
      const PAD = 12;
      const px = (pt) => PAD + pt.t * (cv.width - PAD * 2);
      const py = (pt) => PAD + (1 - pt.v) * (cv.height - PAD * 2);

      const redraw = () => {
        c2.fillStyle = '#0b0e15'; c2.fillRect(0, 0, cv.width, cv.height);
        c2.strokeStyle = 'rgba(130,150,180,0.12)';
        for (let i = 0; i <= 8; i++) {
          const gx = PAD + i / 8 * (cv.width - PAD * 2);
          c2.beginPath(); c2.moveTo(gx, PAD); c2.lineTo(gx, cv.height - PAD); c2.stroke();
        }
        for (let i = 0; i <= 4; i++) {
          const gy = PAD + i / 4 * (cv.height - PAD * 2);
          c2.beginPath(); c2.moveTo(PAD, gy); c2.lineTo(cv.width - PAD, gy); c2.stroke();
        }
        c2.strokeStyle = 'hsla(265,90%,70%,1)'; c2.lineWidth = 2;
        c2.beginPath();
        a.points.forEach((pt, i) => i ? c2.lineTo(px(pt), py(pt)) : c2.moveTo(px(pt), py(pt)));
        c2.stroke();
        a.points.forEach(pt => {
          c2.fillStyle = '#fff';
          c2.beginPath(); c2.arc(px(pt), py(pt), 5, 0, Math.PI * 2); c2.fill();
          c2.fillStyle = 'hsla(265,90%,60%,1)';
          c2.beginPath(); c2.arc(px(pt), py(pt), 3.4, 0, Math.PI * 2); c2.fill();
        });
      };

      let dragPt = null;
      const ptAt = (mx, my) => a.points.find(pt => Math.abs(px(pt) - mx) < 9 && Math.abs(py(pt) - my) < 9);
      cv.addEventListener('pointerdown', (ev) => {
        const rr = cv.getBoundingClientRect();
        const mx = (ev.clientX - rr.left) * (cv.width / rr.width), my = (ev.clientY - rr.top) * (cv.height / rr.height);
        const hitP = ptAt(mx, my);
        if (ev.button === 2) {
          if (hitP && a.points.length > 2) { a.points = a.points.filter(p2 => p2 !== hitP); redraw(); invalidate(); }
          return;
        }
        if (hitP) { dragPt = hitP; G.undoPush('Automation point'); }
        else {
          G.undoPush('Automation point');
          const pt = { t: G.clamp((mx - PAD) / (cv.width - PAD * 2), 0, 1), v: G.clamp(1 - (my - PAD) / (cv.height - PAD * 2), 0, 1) };
          a.points.push(pt);
          a.points.sort((x2, y2) => x2.t - y2.t);
          dragPt = pt;
          redraw(); invalidate();
        }
        cv.setPointerCapture(ev.pointerId);
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!dragPt) return;
        const rr = cv.getBoundingClientRect();
        const mx = (ev.clientX - rr.left) * (cv.width / rr.width), my = (ev.clientY - rr.top) * (cv.height / rr.height);
        dragPt.t = G.clamp((mx - PAD) / (cv.width - PAD * 2), 0, 1);
        dragPt.v = G.clamp(1 - (my - PAD) / (cv.height - PAD * 2), 0, 1);
        a.points.sort((x2, y2) => x2.t - y2.t);
        redraw(); invalidate();
      });
      cv.addEventListener('pointerup', () => { dragPt = null; });
      cv.addEventListener('contextmenu', ev => ev.preventDefault());

      G.el('div', 'dim small', body, 'Click to add points · drag to shape · right-click removes · the clip stretches this curve over its length');
      const delBtn = G.el('button', 'btn danger-btn', body, '🗑 Delete automation');
      delBtn.addEventListener('click', () => {
        G.undoPush('Delete automation');
        G.proj.automations = G.proj.automations.filter(x2 => x2.id !== a.id);
        tracks().forEach(tr => tr.clips = tr.clips.filter(cl => cl.autoId !== a.id));
        close(); buildToolbar(); invalidate();
      });
      redraw();
    }, { cls: 'wide' });
  };

  // ---------- toolbar ----------
  const buildToolbar = () => {
    if (!toolbar) return;
    ensureBrush();
    toolbar.innerHTML = '';
    G.el('span', 'dim', toolbar, 'BRUSH');
    const opts = [];
    G.proj.patterns.forEach(p => opts.push(['pat:' + p.id, '▦ ' + p.name]));
    G.proj.automations.forEach(a => opts.push(['auto:' + a.id, '⚙ ' + a.name]));
    const cur = brush.type + ':' + brush.id;
    toolbar.appendChild(G.select(opts, cur, v => {
      const [type, ...rest] = v.split(':');
      brush = { type, id: rest.join(':') };
    }));

    const newAutoBtn = G.el('button', 'btn subtle', toolbar, '＋ Automation');
    newAutoBtn.addEventListener('click', newAutomation);

    G.el('span', 'dim pad-l', toolbar, 'SNAP');
    toolbar.appendChild(G.select([[String(G.BAR), 'Bar'], [String(G.PPQ), 'Beat'], [String(G.STEP), '1/16']], String(snapTicks), v => snapTicks = parseInt(v, 10)));

    const loopBtn = G.el('button', 'btn subtle' + (proj().loop.on ? ' active' : ''), toolbar, '∞ Loop');
    loopBtn.title = 'Toggle loop region (shift-drag the ruler to set it)';
    loopBtn.addEventListener('click', () => { proj().loop.on = !proj().loop.on; buildToolbar(); invalidate(); });

    const zoomOut = G.el('button', 'mini-btn', toolbar, '−');
    G.el('span', 'dim', toolbar, 'zoom');
    const zoomIn = G.el('button', 'mini-btn', toolbar, '+');
    zoomOut.addEventListener('click', () => { ppt = Math.max(0.03, ppt / 1.3); invalidate(); });
    zoomIn.addEventListener('click', () => { ppt = Math.min(1.2, ppt * 1.3); invalidate(); });

    G.el('span', 'pr-hint', toolbar, 'Paint clips with the brush · drag to move · right-click erases · double-click opens · click ruler seeks · shift-drag ruler sets loop');
  };

  // ---------- mount ----------
  V.playlist = Object.assign(V.playlist, {
    _seek: null,
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
      canvas.addEventListener('dblclick', onDblClick);
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const r = canvas.getBoundingClientRect();
          const mx = e.clientX - r.left;
          const tickAt = xToTick(mx);
          ppt = G.clamp(ppt * (e.deltaY < 0 ? 1.12 : 0.89), 0.03, 1.2);
          scrollX = Math.max(0, tickAt * ppt - (mx - HEAD_W));
        } else if (e.shiftKey) {
          scrollX = Math.max(0, scrollX + (e.deltaY + e.deltaX) * 0.9);
        } else {
          scrollY = Math.max(0, scrollY + e.deltaY * 0.5);
        }
        invalidate();
      }, { passive: false });
      buildToolbar();
      invalidate();
    },
    refresh() { buildToolbar(); invalidate(); },
    tick() { if (G.transport.playing || needsDraw) draw(); },
    invalidate,
    getSeek() { return V.playlist._seek; },
  });

  V.song = V.playlist;   // tab id alias

  ['patterns', 'playlist', 'channels', 'project'].forEach(evt => G.on(evt, () => { if (G.sel.tab === 'song') { buildToolbar(); invalidate(); } }));

})(window.G);
