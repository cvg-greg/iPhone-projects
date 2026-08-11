/* ============================================================
   GENENGINE — steps.js
   Channel Rack + Step Sequencer (FL Studio style).
   Click steps to place hits; drag vertically on a lit step to
   shape velocity; melodic channels open the Piano Roll.
   ============================================================ */
'use strict';
(function (G) {

  const V = G.views = G.views || {};
  let root = null, stepsScroller = null, posLine = null;

  const stepW = 26, stepGap = 3;

  const render = () => {
    if (!root) return;
    const proj = G.proj;
    const pat = G.curPattern();
    if (!pat) return;
    root.innerHTML = '';

    // ---------- pattern bar ----------
    const patBar = G.el('div', 'pat-bar', root);
    G.el('span', 'pat-label', patBar, 'PATTERNS');
    const chips = G.el('div', 'pat-chips', patBar);
    proj.patterns.forEach((p, i) => {
      const chip = G.el('div', 'pat-chip' + (p.id === pat.id ? ' active' : '') + (G.transport.queuedPattern === p.id ? ' queued' : ''), chips);
      chip.style.setProperty('--hue', p.hue);
      G.el('span', 'pat-chip-num', chip, String(i + 1));
      G.el('span', '', chip, p.name);
      chip.title = 'Click: select / queue live · Right-click: menu · Keys 1-9 switch';
      chip.addEventListener('click', () => { G.transport.queuePattern(p.id); });
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        G.menu(e.clientX, e.clientY, [
          { label: '✏️ Rename', action: () => renamePattern(p) },
          { label: '⧉ Clone', action: () => G.clonePattern(p.id) },
          { label: '＋ Add bar', action: () => { G.undoPush('Pattern length'); p.bars++; G.emit('notes'); } },
          { label: '－ Remove bar', action: () => { if (p.bars > 1) { G.undoPush('Pattern length'); p.bars--; G.emit('notes'); } } },
          { sep: true },
          { label: '🗑 Delete', danger: true, action: () => G.removePattern(p.id) },
        ]);
      });
    });
    const addPat = G.el('button', 'pat-add', patBar, '＋');
    addPat.title = 'New pattern';
    addPat.addEventListener('click', () => G.addPattern());

    const lenWrap = G.el('div', 'pat-len', patBar);
    G.el('span', 'dim', lenWrap, 'BARS');
    const minus = G.el('button', 'mini-btn', lenWrap, '–');
    G.el('span', 'pat-len-num', lenWrap, String(pat.bars));
    const plus = G.el('button', 'mini-btn', lenWrap, '+');
    minus.addEventListener('click', () => { if (pat.bars > 1) { G.undoPush('Pattern length'); pat.bars--; G.emit('notes'); } });
    plus.addEventListener('click', () => { if (pat.bars < 16) { G.undoPush('Pattern length'); pat.bars++; G.emit('notes'); } });

    // ---------- rack ----------
    const rack = G.el('div', 'rack', root);
    const totalSteps = pat.bars * 16;

    if (!proj.channels.length) {
      const empty = G.el('div', 'rack-empty', rack);
      G.el('div', 'rack-empty-big', empty, 'No instruments yet');
      const b = G.el('button', 'btn glow', empty, '＋ Add instruments from the Library');
      b.addEventListener('click', () => G.setTab('library'));
      return;
    }

    const rows = G.el('div', 'rack-rows', rack);

    proj.channels.forEach(chan => {
      const row = G.el('div', 'chan-row' + (chan.id === G.sel.channelId ? ' selected' : ''), rows);
      row.style.setProperty('--hue', chan.hue);

      // left cluster
      const left = G.el('div', 'chan-left', row);
      const dot = G.el('div', 'chan-dot' + (chan.mute ? ' muted' : ''), left);
      dot.title = 'Mute / unmute (right-click: solo)';
      dot.addEventListener('click', () => { chan.mute = !chan.mute; G.audio.applyAllMutes(); G.emit('channels'); });
      dot.addEventListener('contextmenu', (e) => { e.preventDefault(); chan.solo = !chan.solo; G.audio.applyAllMutes(); G.emit('channels'); });
      if (chan.solo) dot.classList.add('solo');

      const name = G.el('div', 'chan-name', left, chan.name);
      name.title = 'Click: select · Double-click: Piano Roll · Right-click: menu';
      name.addEventListener('click', () => { G.sel.channelId = chan.id; G.emit('channels'); });
      name.addEventListener('dblclick', () => { G.sel.channelId = chan.id; G.setTab('piano'); });
      name.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        G.menu(e.clientX, e.clientY, [
          { label: '🎹 Open in Piano Roll', action: () => { G.sel.channelId = chan.id; G.setTab('piano'); } },
          { label: '🎛 Show in Mixer', action: () => { G.sel.channelId = chan.id; G.setTab('mixer'); } },
          { label: '✏️ Rename', action: () => renameChannel(chan) },
          { label: '⧉ Duplicate', action: () => dupChannel(chan) },
          { sep: true },
          { label: '⌫ Clear steps in this pattern', action: () => { G.undoPush('Clear steps'); pat.notes[chan.id] = []; G.emit('notes'); } },
          { label: '🗑 Delete channel', danger: true, action: () => G.removeChannel(chan.id) },
        ]);
      });

      const knobs = G.el('div', 'chan-knobs', left);
      knobs.appendChild(G.knob({
        label: '', min: -12, max: 12, def: 0, value: chan.pitch, size: 22,
        fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' st',
        onInput: v => G.audio.setChanPitch(chan, v),
      }));
      knobs.appendChild(G.knob({
        label: '', min: -1, max: 1, def: 0, value: chan.pan, size: 22,
        fmt: v => v === 0 ? 'C' : (v < 0 ? (-v * 100).toFixed(0) + 'L' : (v * 100).toFixed(0) + 'R'),
        onInput: v => { chan.pan = v; G.audio.applyChanParams(chan); },
      }));
      knobs.appendChild(G.knob({
        label: '', min: 0, max: 1, def: 0.8, value: chan.vol, size: 22,
        fmt: v => (v * 100).toFixed(0) + '%',
        onInput: v => { chan.vol = v; G.audio.applyChanParams(chan); },
      }));

      // steps
      const stepsWrap = G.el('div', 'chan-steps', row);
      const notes = G.notesFor(pat, chan.id);
      for (let i = 0; i < totalSteps; i++) {
        const t0 = i * G.STEP, t1 = t0 + G.STEP;
        const inStep = notes.filter(n => n.t >= t0 && n.t < t1);
        const on = inStep.length > 0;
        const st = G.el('div', 'step' + (on ? ' on' : '') + (i % 8 >= 4 ? ' alt' : ''), stepsWrap);
        if (i % 4 === 0) st.classList.add('beat');
        if (on) st.style.setProperty('--vel', Math.max(0.25, inStep[0].v));

        let startVel = 0, velSnap = null;
        G.drag(st, {
          button: 0,
          onStart: () => {
            if (on) { startVel = inStep[0].v; velSnap = G.undoCapture(); }
            else {
              G.undoPush('Add step');
              const pitch = defaultPitch(chan, notes);
              notes.push({ t: t0, d: G.STEP - 2, p: pitch, v: 0.85 });
              G.audio.previewNote(chan, pitch, 0.2);
              G.emit('notes');
              return false; // re-render replaced the node; stop drag
            }
          },
          onMove: (dx, dy) => {
            if (!on) return;
            const v = G.clamp(startVel - dy / 80, 0.05, 1);
            inStep.forEach(n => n.v = v);
            st.style.setProperty('--vel', Math.max(0.25, v));
            st.title = 'velocity ' + Math.round(v * 100) + '%';
          },
          onEnd: (e, moved) => {
            if (!on) return;
            if (!moved) {
              G.undoPush('Remove step');
              pat.notes[chan.id] = notes.filter(n => !(n.t >= t0 && n.t < t1));
              G.emit('notes');
            } else if (velSnap) { G.undoCommit('Step velocity', velSnap); }
          },
        });
        st.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (on) { G.undoPush('Remove step'); pat.notes[chan.id] = notes.filter(n => !(n.t >= t0 && n.t < t1)); G.emit('notes'); }
        });
      }
      if (chan.kind !== 'drum') {
        const hasOffGrid = notes.some(n => n.t % G.STEP !== 0 || n.d > G.STEP);
        if (hasOffGrid) {
          const badge = G.el('div', 'melodic-badge', stepsWrap, '🎹 melody — open piano roll');
          badge.addEventListener('click', () => { G.sel.channelId = chan.id; G.setTab('piano'); });
        }
      }
    });

    // add channel row
    const addRow = G.el('div', 'chan-add-row', rows);
    const addBtn = G.el('button', 'btn subtle', addRow, '＋ Add instrument');
    addBtn.addEventListener('click', () => G.setTab('library'));

    // position line
    stepsScroller = rack;
    posLine = G.el('div', 'rack-posline', rows);
    posLine.style.display = 'none';
  };

  const defaultPitch = (chan, notes) => {
    if (chan._stepPitch) return chan._stepPitch;
    if (chan.kind === 'drum') return 60;
    if (notes && notes.length) return notes[notes.length - 1].p;   // match what's already there
    if (chan.defPitch) return chan.defPitch;
    const pr = G.presets.instruments.find(p => p.name === chan.name);
    return pr ? pr.pitch : 60;
  };

  const renamePattern = (p) => {
    G.modal('Rename pattern', (body, close) => {
      const inp = G.el('input', 'ginput', body); inp.value = p.name;
      const b = G.el('button', 'btn glow', body, 'Save');
      const doIt = () => { G.undoPush('Rename'); p.name = inp.value || p.name; close(); G.emit('patterns'); };
      b.addEventListener('click', doIt);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doIt(); });
      setTimeout(() => inp.select(), 50);
    });
  };

  const renameChannel = (chan) => {
    G.modal('Rename channel', (body, close) => {
      const inp = G.el('input', 'ginput', body); inp.value = chan.name;
      const b = G.el('button', 'btn glow', body, 'Save');
      const doIt = () => { G.undoPush('Rename'); chan.name = inp.value || chan.name; close(); G.emit('channels'); };
      b.addEventListener('click', doIt);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doIt(); });
      setTimeout(() => inp.select(), 50);
    });
  };

  const dupChannel = (chan) => {
    G.undoPush('Duplicate channel');
    const c = G.deepCopy(chan);
    c.id = G.uid(); c.name = chan.name + ' 2';
    c.fx.forEach(f => f.id = G.uid());
    if (chan.sample && chan.sample.buffer) c.sample = { name: chan.sample.name, buffer: chan.sample.buffer };
    const i = G.proj.channels.findIndex(x => x.id === chan.id);
    G.proj.channels.splice(i + 1, 0, c);
    c.hue = G.hueFor(G.proj.channels.length);
    // copy notes in all patterns
    G.proj.patterns.forEach(p => { if (p.notes[chan.id]) p.notes[c.id] = G.deepCopy(p.notes[chan.id]); });
    G.emit('channels'); G.emit('notes');
  };

  // playhead
  const tickPos = () => {
    if (!posLine || !root || !root.isConnected) return;
    if (G.transport.playing && G.transport.mode === 'pat') {
      const pat = G.curPattern();
      const ticks = G.transport.posTicks() % G.patTicks(pat);
      const step = ticks / G.STEP;
      const leftCol = root.querySelector('.chan-left');
      const lw = leftCol ? leftCol.getBoundingClientRect().width + 10 : 264;
      posLine.style.display = 'block';
      posLine.style.left = (lw + step * (stepW + stepGap)) + 'px';
    } else {
      posLine.style.display = 'none';
    }
  };

  V.steps = {
    mount(el) { root = el; render(); },
    refresh: render,
    tick: tickPos,
  };

  ['notes', 'channels', 'patterns', 'project'].forEach(evt => G.on(evt, () => { if (G.sel.tab === 'steps') render(); }));

})(window.G);
