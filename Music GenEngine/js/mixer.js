/* ============================================================
   GENENGINE — mixer.js
   Mixer strips (fader, meter, pan, mute/solo, sends) plus the
   FX chain editor with every effect's parameters, chain presets,
   master section and global send buses.
   ============================================================ */
'use strict';
(function (G) {

  const V = G.views = G.views || {};
  let root, stripsEl, fxPanel;
  let fxSel = { scope: 'chan', fxId: null };   // scope: 'chan' | 'master'
  let meterRAF = null;

  const render = () => {
    if (!root) return;
    root.innerHTML = '';
    stripsEl = G.el('div', 'mixer-strips', root);
    fxPanel = G.el('div', 'fx-panel', root);

    G.proj.channels.forEach(ch => stripsEl.appendChild(buildStrip(ch)));
    stripsEl.appendChild(buildBusStrip('A'));
    stripsEl.appendChild(buildBusStrip('B'));
    stripsEl.appendChild(buildMasterStrip());
    renderFxPanel();
  };

  // ---------------- strips ----------------
  const buildStrip = (ch) => {
    const strip = G.el('div', 'mstrip' + (G.sel.channelId === ch.id && fxSel.scope === 'chan' ? ' selected' : ''));
    strip.style.setProperty('--hue', ch.hue);
    const name = G.el('div', 'mstrip-name', strip, ch.name);
    name.title = ch.name;
    strip.addEventListener('pointerdown', () => {
      if (G.sel.channelId !== ch.id || fxSel.scope !== 'chan') {
        G.sel.channelId = ch.id; fxSel = { scope: 'chan', fxId: (ch.fx[0] || {}).id || null };
        render();
      }
    });

    const panWrap = G.el('div', 'mstrip-pan', strip);
    panWrap.appendChild(G.knob({
      label: 'PAN', min: -1, max: 1, def: 0, value: ch.pan, size: 26,
      fmt: v => v === 0 ? 'C' : (v < 0 ? (-v * 100).toFixed(0) + 'L' : (v * 100).toFixed(0) + 'R'),
      onInput: v => { ch.pan = v; G.audio.applyChanParams(ch); },
    }));

    const sends = G.el('div', 'mstrip-sends', strip);
    sends.appendChild(G.knob({
      label: 'REV', min: 0, max: 1, def: 0, value: ch.sendA, size: 22,
      fmt: v => (v * 100).toFixed(0) + '%',
      onInput: v => { ch.sendA = v; G.audio.applyChanParams(ch); },
    }));
    sends.appendChild(G.knob({
      label: 'DLY', min: 0, max: 1, def: 0, value: ch.sendB, size: 22,
      fmt: v => (v * 100).toFixed(0) + '%',
      onInput: v => { ch.sendB = v; G.audio.applyChanParams(ch); },
    }));

    const fadRow = G.el('div', 'mstrip-fader-row', strip);
    fadRow.appendChild(buildFader(ch.vol, v => { ch.vol = v; G.audio.applyChanParams(ch); }));
    const meter = G.el('canvas', 'mstrip-meter', fadRow);
    meter.width = 8; meter.height = 120;
    meter._chanId = ch.id;

    const ms = G.el('div', 'mstrip-ms', strip);
    const mBtn = G.el('button', 'ms-btn' + (ch.mute ? ' on-m' : ''), ms, 'M');
    const sBtn = G.el('button', 'ms-btn' + (ch.solo ? ' on-s' : ''), ms, 'S');
    mBtn.addEventListener('click', (e) => { e.stopPropagation(); ch.mute = !ch.mute; G.audio.applyAllMutes(); render(); });
    sBtn.addEventListener('click', (e) => { e.stopPropagation(); ch.solo = !ch.solo; G.audio.applyAllMutes(); render(); });

    const fxList = G.el('div', 'mstrip-fx', strip);
    ch.fx.forEach(fx => {
      const d = G.fx.defs[fx.type];
      const chip = G.el('div', 'fx-chip' + (fx.on ? '' : ' off') + (fxSel.scope === 'chan' && G.sel.channelId === ch.id && fxSel.fxId === fx.id ? ' selected' : ''), fxList, (d ? d.icon + ' ' : '') + (d ? d.name : fx.type));
      chip.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        G.sel.channelId = ch.id; fxSel = { scope: 'chan', fxId: fx.id };
        render();
      });
    });
    return strip;
  };

  const buildFader = (value, onInput) => {
    const wrap = G.el('div', 'fader');
    const track = G.el('div', 'fader-track', wrap);
    const fill = G.el('div', 'fader-fill', track);
    const handle = G.el('div', 'fader-handle', track);
    const H = 120;
    const setPos = (v) => {
      fill.style.height = (v * 100) + '%';
      handle.style.bottom = 'calc(' + (v * 100) + '% - 7px)';
    };
    let cur = value;
    setPos(cur);
    let startV;
    G.drag(track, {
      cursor: 'ns-resize',
      onStart: (e) => {
        const r = track.getBoundingClientRect();
        cur = G.clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
        startV = cur; setPos(cur); onInput(cur);
      },
      onMove: (dx, dy, e) => {
        const fine = e.shiftKey ? 0.25 : 1;
        cur = G.clamp(startV - dy / H * fine, 0, 1);
        setPos(cur); onInput(cur);
      },
    });
    track.addEventListener('dblclick', () => { cur = 0.8; setPos(cur); onInput(cur); });
    return wrap;
  };

  const buildBusStrip = (which) => {
    const isA = which === 'A';
    const p = isA ? G.proj.sendAFx : G.proj.sendBFx;
    const strip = G.el('div', 'mstrip bus');
    strip.style.setProperty('--hue', isA ? 186 : 265);
    G.el('div', 'mstrip-name', strip, isA ? '✧ SPACE VERB' : '⧉ SYNC ECHO');
    const box = G.el('div', 'bus-knobs', strip);
    if (isA) {
      box.appendChild(G.knob({ label: 'SIZE', min: 0.3, max: 9, def: 3.2, value: p.size, size: 26, curve: 'exp', unit: 's', onEnd: v => { p.size = v; G.audio.refreshBuses(); } }));
      box.appendChild(G.knob({ label: 'DECAY', min: 0.8, max: 6, def: 3.5, value: p.decay, size: 26, onEnd: v => { p.decay = v; G.audio.refreshBuses(); } }));
      box.appendChild(G.knob({ label: 'TONE', min: 800, max: 18000, def: 5200, value: p.tone, size: 26, curve: 'exp', unit: 'Hz', onEnd: v => { p.tone = v; G.audio.refreshBuses(); } }));
      box.appendChild(G.knob({ label: 'LEVEL', min: 0, max: 1.5, def: 1, value: p.mix, size: 26, onInput: v => { p.mix = v; G.audio.refreshBuses(); } }));
    } else {
      const selWrap = G.el('div', 'bus-time', box);
      G.el('div', 'knob-label', selWrap, 'TIME');
      selWrap.appendChild(G.select([['1/32', '1/32'], ['1/16', '1/16'], ['1/8', '1/8'], ['3/16', '3/16'], ['1/4', '1/4'], ['1/2', '1/2']], p.time, v => { p.time = v; G.audio.refreshBuses(); }));
      box.appendChild(G.knob({ label: 'FEEDB', min: 0, max: 0.92, def: 0.42, value: p.feedback, size: 26, onInput: v => { p.feedback = v; G.audio.refreshBuses(); } }));
      box.appendChild(G.knob({ label: 'TONE', min: 400, max: 12000, def: 3800, value: p.tone, size: 26, curve: 'exp', unit: 'Hz', onInput: v => { p.tone = v; G.audio.refreshBuses(); } }));
      box.appendChild(G.knob({ label: 'LEVEL', min: 0, max: 1.5, def: 1, value: p.mix, size: 26, onInput: v => { p.mix = v; G.audio.refreshBuses(); } }));
    }
    G.el('div', 'bus-desc', strip, isA ? 'global reverb bus — feed with REV knobs' : 'global delay bus — feed with DLY knobs');
    return strip;
  };

  const buildMasterStrip = () => {
    const strip = G.el('div', 'mstrip master' + (fxSel.scope === 'master' ? ' selected' : ''));
    G.el('div', 'mstrip-name', strip, '◈ MASTER');
    strip.addEventListener('pointerdown', () => {
      if (fxSel.scope !== 'master') { fxSel = { scope: 'master', fxId: (G.proj.masterFx[0] || {}).id || null }; render(); }
    });
    const fadRow = G.el('div', 'mstrip-fader-row', strip);
    fadRow.appendChild(buildFader(G.proj.masterVol, v => { G.proj.masterVol = v; G.audio.setMasterVol(v); }));
    const meter = G.el('canvas', 'mstrip-meter', fadRow);
    meter.width = 8; meter.height = 120;
    meter._master = true;
    const fxList = G.el('div', 'mstrip-fx', strip);
    G.proj.masterFx.forEach(fx => {
      const d = G.fx.defs[fx.type];
      const chip = G.el('div', 'fx-chip' + (fx.on ? '' : ' off') + (fxSel.scope === 'master' && fxSel.fxId === fx.id ? ' selected' : ''), fxList, (d ? d.icon + ' ' : '') + (d ? d.name : fx.type));
      chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); fxSel = { scope: 'master', fxId: fx.id }; render(); });
    });
    G.el('div', 'bus-desc', strip, 'brickwall limiter always on');
    return strip;
  };

  // ---------------- FX panel ----------------
  const curFxArr = () => fxSel.scope === 'master' ? G.proj.masterFx : (G.curChannel() ? G.curChannel().fx : []);
  const curFxOwnerName = () => fxSel.scope === 'master' ? 'MASTER' : (G.curChannel() ? G.curChannel().name : '—');
  const applyFxUpdate = (fx) => {
    if (fxSel.scope === 'master') G.audio.updateMasterFx(fx);
    else G.audio.updateFx(G.curChannel(), fx);
  };
  const rebuildOwner = () => {
    if (fxSel.scope === 'master') G.audio.rebuildAll();
    else G.audio.rebuildStrip(G.curChannel());
  };

  const renderFxPanel = () => {
    fxPanel.innerHTML = '';
    const head = G.el('div', 'fx-panel-head', fxPanel);
    G.el('div', 'fx-panel-title', head, '⛓ FX — ' + curFxOwnerName());

    const arr = curFxArr();

    // chain list
    const list = G.el('div', 'fx-chain-list', fxPanel);
    arr.forEach((fx, i) => {
      const d = G.fx.defs[fx.type];
      const row = G.el('div', 'fx-row' + (fxSel.fxId === fx.id ? ' selected' : ''), list);
      const onBtn = G.el('button', 'fx-on' + (fx.on ? ' lit' : ''), row, '●');
      onBtn.title = 'Bypass';
      onBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        G.undoPush('Toggle FX'); fx.on = !fx.on; rebuildOwner(); renderFxPanel(); render();
      });
      G.el('span', 'fx-row-name', row, (d ? d.icon + ' ' + d.name : fx.type));
      const up = G.el('button', 'mini-btn', row, '▲');
      const dn = G.el('button', 'mini-btn', row, '▼');
      const del = G.el('button', 'mini-btn danger', row, '✕');
      up.addEventListener('click', (e) => { e.stopPropagation(); if (i > 0) { G.undoPush('Reorder FX'); arr.splice(i, 1); arr.splice(i - 1, 0, fx); rebuildOwner(); render(); } });
      dn.addEventListener('click', (e) => { e.stopPropagation(); if (i < arr.length - 1) { G.undoPush('Reorder FX'); arr.splice(i, 1); arr.splice(i + 1, 0, fx); rebuildOwner(); render(); } });
      del.addEventListener('click', (e) => { e.stopPropagation(); G.undoPush('Remove FX'); arr.splice(i, 1); if (fxSel.fxId === fx.id) fxSel.fxId = null; rebuildOwner(); render(); });
      row.addEventListener('click', () => { fxSel.fxId = fx.id; renderFxPanel(); });
    });

    // add fx / chain presets
    const addRow = G.el('div', 'fx-add-row', fxPanel);
    const addSel = G.select([['', '＋ Add effect…'], ...Object.keys(G.fx.defs).map(t => [t, G.fx.defs[t].icon + ' ' + G.fx.defs[t].name])], '', (v) => {
      if (!v) return;
      G.undoPush('Add FX');
      const fx = G.fx.newFx(v);
      arr.push(fx); fxSel.fxId = fx.id;
      rebuildOwner(); render();
    });
    addRow.appendChild(addSel);
    const chainSel = G.select([['', '⛓ Chain preset…'], ...G.presets.fxChains.map(c => [c.name, c.name])], '', (v) => {
      if (!v) return;
      const preset = G.presets.fxChains.find(c => c.name === v);
      if (!preset) return;
      G.undoPush('FX chain preset');
      preset.fx.forEach(([type, params]) => {
        const fx = G.fx.newFx(type);
        Object.assign(fx.params, params || {});
        arr.push(fx);
      });
      rebuildOwner(); render();
    });
    addRow.appendChild(chainSel);

    // selected fx params
    const fx = arr.find(f => f.id === fxSel.fxId) || arr[0];
    if (!fx) {
      G.el('div', 'fx-empty', fxPanel, 'No effects yet.\nAdd a flanger, phaser, crusher, trance gate, sidechain pump…');
      return;
    }
    fxSel.fxId = fx.id;
    const d = G.fx.defs[fx.type];
    const pbox = G.el('div', 'fx-params', fxPanel);
    G.el('div', 'fx-params-title', pbox, d.icon + ' ' + d.name);
    const grid = G.el('div', 'fx-params-grid', pbox);

    Object.keys(d.params).forEach(key => {
      const pd = d.params[key];
      if (pd.type === 'select') {
        const wrap = G.el('div', 'fx-param-sel', grid);
        G.el('div', 'knob-label', wrap, pd.label);
        wrap.appendChild(G.select(pd.options, fx.params[key], v => {
          G.undoPush('FX param'); fx.params[key] = v; applyFxUpdate(fx);
        }));
      } else if (pd.type === 'gatePattern') {
        const wrap = G.el('div', 'gate-editor', grid);
        G.el('div', 'knob-label', wrap, 'PATTERN — click steps');
        const cells = G.el('div', 'gate-cells', wrap);
        const pat = (fx.params[key] || '1111111111111111').padEnd(16, '0').slice(0, 16).split('');
        pat.forEach((bit, i) => {
          const cell = G.el('div', 'gate-cell' + (bit === '1' ? ' on' : '') + (i % 4 === 0 ? ' beat' : ''), cells);
          cell.addEventListener('pointerdown', () => {
            pat[i] = pat[i] === '1' ? '0' : '1';
            fx.params[key] = pat.join('');
            cell.classList.toggle('on');
            applyFxUpdate(fx);
          });
        });
      } else {
        grid.appendChild(G.knob({
          label: pd.label, min: pd.min, max: pd.max, def: pd.def,
          value: fx.params[key], size: 34, unit: pd.unit, curve: pd.curve, fmt: pd.fmt,
          onInput: v => { fx.params[key] = v; applyFxUpdate(fx); },
          onEnd: v => { fx.params[key] = v; applyFxUpdate(fx); },
        }));
      }
    });
  };

  // ---------------- meters ----------------
  const meterLoop = () => {
    if (G.sel.tab !== 'mixer' || !root || !root.isConnected) { meterRAF = null; return; }
    G.qsa('.mstrip-meter', root).forEach(cv => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      let level = 0;
      if (G.audio.ctx) {
        let analyser = null;
        if (cv._master) analyser = G.audio.masterAnalyser;
        else { const s = G.audio.strips.get(cv._chanId); analyser = s && s.analyser; }
        if (analyser) {
          const buf = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) level = Math.max(level, Math.abs(buf[i]));
        }
      }
      cv._smooth = Math.max(level, (cv._smooth || 0) * 0.86);
      const h = Math.min(1, cv._smooth) * cv.height;
      const grad = c.createLinearGradient(0, cv.height, 0, 0);
      grad.addColorStop(0, '#22d3ee'); grad.addColorStop(0.7, '#a3e635'); grad.addColorStop(0.92, '#f59e0b'); grad.addColorStop(1, '#f87171');
      c.fillStyle = grad;
      c.fillRect(0, cv.height - h, cv.width, h);
    });
    meterRAF = requestAnimationFrame(meterLoop);
  };

  V.mixer = {
    mount(el) { root = el; render(); if (!meterRAF) meterRAF = requestAnimationFrame(meterLoop); },
    refresh: render,
    tick() {},
  };

  ['channels', 'mixer', 'project'].forEach(evt => G.on(evt, () => { if (G.sel.tab === 'mixer') render(); }));

})(window.G);
