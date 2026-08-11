/* ============================================================
   GENENGINE — util.js
   Shared helpers, DOM builders, knobs, faders, menus, toasts.
   ============================================================ */
'use strict';
window.G = window.G || {};

(function (G) {

  // ---------- misc ----------
  G.PPQ = 96;                    // ticks per quarter note
  G.BAR = G.PPQ * 4;             // 384 ticks per 4/4 bar
  G.STEP = G.PPQ / 4;            // 24 ticks per 1/16 step

  G.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.uid = () => 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  G.deepCopy = (o) => JSON.parse(JSON.stringify(o));

  G.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  G.noteName = (midi) => G.NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  G.isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);
  G.midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Snap grid values in ticks (label → ticks)
  G.SNAPS = [
    ['Bar', 384], ['1/2', 192], ['1/3', 128], ['1/4', 96], ['1/6', 64],
    ['1/8', 48], ['1/12', 32], ['1/16', 24], ['1/24', 16], ['1/32', 12],
    ['1/48', 8], ['1/64', 6], ['None', 1],
  ];

  G.fmtTime = (ticks, bpm) => {
    const bar = Math.floor(ticks / G.BAR) + 1;
    const beat = Math.floor((ticks % G.BAR) / G.PPQ) + 1;
    const step = Math.floor((ticks % G.PPQ) / G.STEP) + 1;
    return `${String(bar).padStart(3, '0')}:${beat}:${step}`;
  };

  G.channelHues = [186, 320, 265, 24, 145, 45, 205, 350, 90, 285, 12, 165, 226, 55, 305, 130];
  G.hueFor = (i) => G.channelHues[i % G.channelHues.length];

  // ---------- pub/sub ----------
  const listeners = {};
  G.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  G.emit = (evt, data) => { (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error('[emit ' + evt + ']', e); } }); };

  // ---------- DOM ----------
  G.el = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  G.qs = (sel, root) => (root || document).querySelector(sel);
  G.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  G.toast = (msg, kind) => {
    const host = G.qs('#toasts') || (() => { const h = G.el('div', '', document.body); h.id = 'toasts'; return h; })();
    const t = G.el('div', 'toast ' + (kind || ''), host, msg);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
  };

  // ---------- generic drag helper ----------
  // opts: {onStart(e), onMove(dx,dy,e), onEnd(e), cursor}
  G.drag = (el, opts) => {
    el.addEventListener('pointerdown', (e) => {
      if (opts.button !== undefined && e.button !== opts.button) return;
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const prevCursor = document.body.style.cursor;
      if (opts.cursor) document.body.style.cursor = opts.cursor;
      if (opts.onStart && opts.onStart(e) === false) { document.body.style.cursor = prevCursor; return; }
      const mv = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        opts.onMove && opts.onMove(dx, dy, ev);
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = prevCursor;
        opts.onEnd && opts.onEnd(ev, moved);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
  };

  // ---------- knob widget ----------
  // opts: {min, max, value, def, label, unit, fmt(v), curve('lin'|'exp'), size, onInput(v), onEnd(v)}
  G.knob = (opts) => {
    const size = opts.size || 38;
    const wrap = G.el('div', 'knob-wrap');
    const kn = G.el('div', 'knob', wrap);
    kn.style.width = kn.style.height = size + 'px';
    const ind = G.el('div', 'knob-ind', kn);
    const lbl = G.el('div', 'knob-label', wrap, opts.label || '');
    const min = opts.min, max = opts.max;
    let value = opts.value !== undefined ? opts.value : (opts.def !== undefined ? opts.def : min);

    const toNorm = (v) => {
      if (opts.curve === 'exp' && min > 0) return Math.log(v / min) / Math.log(max / min);
      return (v - min) / (max - min);
    };
    const fromNorm = (n) => {
      n = G.clamp(n, 0, 1);
      if (opts.curve === 'exp' && min > 0) return min * Math.pow(max / min, n);
      return min + (max - min) * n;
    };
    const fmt = opts.fmt || ((v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) + (opts.unit || ''));

    const render = () => {
      const n = toNorm(value);
      kn.style.setProperty('--rot', (-135 + n * 270) + 'deg');
      kn.title = (opts.label ? opts.label + ': ' : '') + fmt(value);
    };

    let startVal;
    G.drag(kn, {
      cursor: 'ns-resize',
      onStart: () => { startVal = toNorm(value); showVal(); },
      onMove: (dx, dy, e) => {
        const fine = e.shiftKey ? 0.15 : 1;
        value = fromNorm(startVal - dy / 160 * fine);
        render(); showVal();
        opts.onInput && opts.onInput(value);
      },
      onEnd: () => { hideVal(); opts.onEnd && opts.onEnd(value); },
    });
    kn.addEventListener('dblclick', () => {
      value = opts.def !== undefined ? opts.def : (min + max) / 2;
      render(); opts.onInput && opts.onInput(value); opts.onEnd && opts.onEnd(value);
    });
    kn.addEventListener('wheel', (e) => {
      e.preventDefault();
      value = fromNorm(toNorm(value) + (e.deltaY < 0 ? 0.03 : -0.03));
      render(); opts.onInput && opts.onInput(value); clearTimeout(kn._wt);
      kn._wt = setTimeout(() => opts.onEnd && opts.onEnd(value), 300);
    }, { passive: false });

    let valTip = null;
    const showVal = () => {
      if (!valTip) valTip = G.el('div', 'knob-tip', wrap);
      valTip.textContent = fmt(value);
    };
    const hideVal = () => { if (valTip) { valTip.remove(); valTip = null; } };

    render();
    wrap.setValue = (v, silent) => { value = G.clamp(v, min, max); render(); if (!silent) opts.onInput && opts.onInput(value); };
    wrap.getValue = () => value;
    return wrap;
  };

  // ---------- select builder ----------
  G.select = (options, value, onChange, cls) => {
    const s = G.el('select', 'gsel ' + (cls || ''));
    options.forEach(o => {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      const op = G.el('option', '', s, label);
      op.value = val;
    });
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return s;
  };

  // ---------- context menu ----------
  let menuEl = null;
  G.closeMenu = () => { if (menuEl) { menuEl.remove(); menuEl = null; } };
  // items: [{label, action, danger, sep, disabled}]
  G.menu = (x, y, items) => {
    G.closeMenu();
    menuEl = G.el('div', 'ctx-menu', document.body);
    items.forEach(it => {
      if (it.sep) { G.el('div', 'ctx-sep', menuEl); return; }
      const b = G.el('div', 'ctx-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : ''), menuEl, it.label);
      if (!it.disabled) b.addEventListener('click', () => { G.closeMenu(); it.action && it.action(); });
    });
    document.body.appendChild(menuEl);
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    menuEl.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    setTimeout(() => {
      const close = (e) => { if (!menuEl || !menuEl.contains(e.target)) { G.closeMenu(); window.removeEventListener('pointerdown', close); } };
      window.addEventListener('pointerdown', close);
    }, 0);
  };

  // ---------- modal ----------
  G.modal = (title, buildFn, opts) => {
    const ov = G.el('div', 'modal-ov', document.body);
    const box = G.el('div', 'modal ' + ((opts && opts.cls) || ''), ov);
    const head = G.el('div', 'modal-head', box);
    G.el('div', 'modal-title', head, title);
    const closeBtn = G.el('button', 'icon-btn', head, '✕');
    const body = G.el('div', 'modal-body', box);
    const close = () => { ov.remove(); opts && opts.onClose && opts.onClose(); };
    closeBtn.addEventListener('click', close);
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
    buildFn(body, close);
    return { close, body, box };
  };

  // ---------- WAV encoding ----------
  G.encodeWav = (buffers /* [L,R] Float32Array */, sampleRate) => {
    const numCh = buffers.length, len = buffers[0].length;
    const bytesPerSample = 2, blockAlign = numCh * bytesPerSample;
    const buf = new ArrayBuffer(44 + len * blockAlign);
    const view = new DataView(buf);
    const wstr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    wstr(0, 'RIFF'); view.setUint32(4, 36 + len * blockAlign, true); wstr(8, 'WAVE');
    wstr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); wstr(36, 'data'); view.setUint32(40, len * blockAlign, true);
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        let s = Math.max(-1, Math.min(1, buffers[ch][i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return new Blob([buf], { type: 'audio/wav' });
  };

  G.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

})(window.G);
