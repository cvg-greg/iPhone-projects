/* ============================================================
   GENENGINE — main.js
   Boot + glue: transport bar, tabs, computer-keyboard playing,
   live recording, onscreen piano, spectrum visualizer,
   save / open / export, help, autosave.
   ============================================================ */
'use strict';
(function (G) {

  const TABS = [
    ['steps', '▦ CHANNELS', 'F6'],
    ['piano', '🎹 PIANO ROLL', 'F7'],
    ['song', '📽 PLAYLIST', 'F5'],
    ['mixer', '🎛 MIXER', 'F9'],
    ['library', '📚 LIBRARY', 'F8'],
  ];

  let kbdBase = 60;            // C4 for Z row
  let recArmed = false;
  let recUndoPushed = false;
  const heldKeys = new Map();  // key -> pitch

  const KEYROW1 = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12, 'l': 13, '.': 14, ';': 15, '/': 16 };
  const KEYROW2 = { q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20, y: 21, '7': 22, u: 23, i: 24, '9': 25, o: 26, '0': 27, p: 28 };

  // ---------------- tabs ----------------
  G.setTab = (tab) => {
    G.sel.tab = tab;
    G.qsa('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const main = G.qs('#main');
    main.innerHTML = '';
    const host = G.el('div', 'view view-' + tab, main);
    // FL-friendly behavior: playlist edits the song, other editors the pattern
    if (tab === 'song') G.transport.mode = 'song';
    if (tab === 'steps' || tab === 'piano') G.transport.mode = 'pat';
    updateModeUI();
    G.views[tab].mount(host);
  };

  // ---------------- transport bar ----------------
  const buildTopbar = () => {
    const bar = G.qs('#topbar');
    bar.innerHTML = '';

    // logo
    const logo = G.el('div', 'logo', bar);
    logo.innerHTML = '<span class="logo-gen">GEN</span><span class="logo-engine">ENGINE</span>';
    const tag = G.el('div', 'logo-tag', logo, 'music production studio');

    // project name
    const nameWrap = G.el('div', 'proj-name-wrap', bar);
    const nameEl = G.el('div', 'proj-name', nameWrap, G.proj.name);
    nameEl.contentEditable = 'true'; nameEl.spellcheck = false;
    nameEl.addEventListener('blur', () => { G.proj.name = nameEl.textContent.trim() || 'Untitled'; });
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
    G.on('project', () => { nameEl.textContent = G.proj.name; });

    // transport buttons
    const tp = G.el('div', 'transport', bar);
    const playBtn = G.el('button', 'tbtn play', tp, '▶');
    playBtn.id = 'btn-play';
    playBtn.title = 'Play / pause (Space)';
    const stopBtn = G.el('button', 'tbtn', tp, '⏹');
    stopBtn.title = 'Stop';
    const recBtn = G.el('button', 'tbtn rec', tp, '●');
    recBtn.title = 'Record armed: while playing, notes you play on the keyboard are written into the current pattern';
    playBtn.addEventListener('click', async () => { await G.audio.init(); G.transport.toggle(); });
    stopBtn.addEventListener('click', () => {
      G.transport.stop();
      G.transport.startFrom = null;
      if (G.views.playlist) { G.views.playlist._seek = null; G.views.playlist.invalidate && G.views.playlist.invalidate(); }
    });
    recBtn.addEventListener('click', () => { recArmed = !recArmed; recUndoPushed = false; recBtn.classList.toggle('armed', recArmed); });

    // mode toggle
    const modeSeg = G.el('div', 'seg mode-seg', tp);
    const patB = G.el('button', 'seg-btn', modeSeg, 'PAT');
    const songB = G.el('button', 'seg-btn', modeSeg, 'SONG');
    patB.id = 'mode-pat'; songB.id = 'mode-song';
    patB.addEventListener('click', () => { G.transport.mode = 'pat'; updateModeUI(); });
    songB.addEventListener('click', () => { G.transport.mode = 'song'; updateModeUI(); });

    // bpm
    const bpmWrap = G.el('div', 'bpm-wrap', tp);
    const bpmVal = G.el('div', 'bpm-val', bpmWrap, G.proj.bpm.toFixed(1));
    G.el('div', 'bpm-label', bpmWrap, 'BPM — drag / double-click');
    let bpmStart;
    G.drag(bpmVal, {
      cursor: 'ns-resize',
      onStart: () => { bpmStart = G.proj.bpm; },
      onMove: (dx, dy) => { G.transport.setBpm(bpmStart - dy / 4); },
    });
    bpmVal.addEventListener('dblclick', () => {
      const v = prompt('Tempo (BPM)', G.proj.bpm);
      if (v) G.transport.setBpm(parseFloat(v));
    });
    G.on('bpm', () => { bpmVal.textContent = G.proj.bpm.toFixed(1); });
    G.on('project', () => { bpmVal.textContent = G.proj.bpm.toFixed(1); });

    // swing
    tp.appendChild(G.knob({
      label: 'SWING', min: 0, max: 1, def: 0, value: G.proj.swing, size: 30,
      fmt: v => (v * 100).toFixed(0) + '%',
      onInput: v => { G.proj.swing = v; },
    }));

    // metronome
    const met = G.el('button', 'tbtn small', tp, '🜛');
    met.title = 'Metronome'; met.textContent = '⏱';
    met.addEventListener('click', () => { G.transport.metronome = !G.transport.metronome; met.classList.toggle('active', G.transport.metronome); });

    // position
    const pos = G.el('div', 'pos-display', tp, '001:1:1');
    pos.id = 'pos-display';

    // visualizer
    const viz = G.el('canvas', 'viz', bar);
    viz.id = 'viz'; viz.width = 200; viz.height = 40;

    // master volume
    bar.appendChild(G.knob({
      label: 'MASTER', min: 0, max: 1, def: 0.85, value: G.proj.masterVol, size: 34,
      fmt: v => (v * 100).toFixed(0) + '%',
      onInput: v => { G.proj.masterVol = v; G.audio.setMasterVol(v); },
    }));

    // file ops
    const ops = G.el('div', 'file-ops', bar);
    const newB = G.el('button', 'btn subtle', ops, '✦ New');
    const demoB = G.el('button', 'btn subtle', ops, '🚀 Demo');
    const openB = G.el('button', 'btn subtle', ops, '📂 Open');
    const saveB = G.el('button', 'btn subtle', ops, '💾 Save');
    const expB = G.el('button', 'btn glow', ops, '⬇ Export WAV');
    const helpB = G.el('button', 'btn subtle', ops, '?');
    helpB.title = 'Help & shortcuts';

    newB.addEventListener('click', () => {
      if (!confirm('Start a new empty project? (Your current one stays in autosave until you edit)')) return;
      G.transport.stop();
      G.loadProjectData(G.newProject());
      G.setTab('library');
      G.toast('New project — grab instruments from the Library');
    });
    demoB.addEventListener('click', () => {
      if (!confirm('Load the demo song "First Flight"? Unsaved changes are lost.')) return;
      G.transport.stop();
      G.loadProjectData(G.presets.demoProject());
      G.setTab('song');
      G.toast('🚀 First Flight loaded — press SPACE');
    });
    const openInp = G.el('input', '', ops); openInp.type = 'file'; openInp.accept = '.json,.genengine'; openInp.style.display = 'none';
    openB.addEventListener('click', () => openInp.click());
    openInp.addEventListener('change', () => { if (openInp.files[0]) G.openProjectFile(openInp.files[0]); openInp.value = ''; });
    saveB.addEventListener('click', () => G.saveProjectFile());
    expB.addEventListener('click', () => exportDialog());
    helpB.addEventListener('click', () => helpDialog());

    // tabs
    const tabsBar = G.qs('#tabs');
    tabsBar.innerHTML = '';
    TABS.forEach(([id, label, fkey]) => {
      const b = G.el('button', 'tab-btn', tabsBar, label);
      b.dataset.tab = id;
      const hint = G.el('span', 'tab-fkey', b, fkey);
      b.addEventListener('click', () => G.setTab(id));
    });
    const kbdToggle = G.el('button', 'tab-btn kbd-toggle', tabsBar, '🎹 KEYS');
    kbdToggle.addEventListener('click', () => {
      const k = G.qs('#kbd');
      k.classList.toggle('hidden');
      kbdToggle.classList.toggle('active', !k.classList.contains('hidden'));
    });
  };

  const updateModeUI = () => {
    const p = G.qs('#mode-pat'), s = G.qs('#mode-song');
    if (p) p.classList.toggle('active', G.transport.mode === 'pat');
    if (s) s.classList.toggle('active', G.transport.mode === 'song');
  };
  G.on('transport', () => {
    const b = G.qs('#btn-play');
    if (b) { b.textContent = G.transport.playing ? '⏸' : '▶'; b.classList.toggle('playing', G.transport.playing); }
  });

  // ---------------- export ----------------
  const exportDialog = () => {
    G.modal('⬇ Export audio', (body, close) => {
      G.el('div', 'dim', body, 'Renders offline through the full mixer, FX and automation. 16-bit stereo WAV.');
      const b1 = G.el('button', 'btn glow big', body, '🎵 Export full song  (playlist)');
      const b2 = G.el('button', 'btn subtle big', body, '▦ Export current pattern  (' + G.curPattern().name + ')');
      const status = G.el('div', 'dim small', body, '');
      const run = async (scope) => {
        status.textContent = '⏳ Rendering…';
        try {
          const blob = await G.audio.exportWav(scope);
          const name = (G.proj.name || 'genengine').replace(/[^\w\- ]+/g, '') + (scope === 'pattern' ? ' - ' + G.curPattern().name : '') + '.wav';
          G.download(blob, name);
          status.textContent = '✅ Done — check your downloads';
          G.toast('🎧 Exported ' + name);
        } catch (e) {
          console.error(e);
          status.textContent = '❌ ' + e.message;
        }
      };
      b1.addEventListener('click', () => run('song'));
      b2.addEventListener('click', () => run('pattern'));
    });
  };

  // ---------------- help ----------------
  const helpDialog = () => {
    G.modal('❔ GENENGINE — quick guide', (body) => {
      body.innerHTML = `
      <div class="help-cols">
        <div>
          <h3>Workflow (like FL Studio)</h3>
          <ol>
            <li><b>LIBRARY</b> — add instruments to the rack (or drop in your GarageBand samples)</li>
            <li><b>CHANNELS</b> — click steps for drums; double-click a channel for melodies</li>
            <li><b>PIANO ROLL</b> — draw notes, snap down to 1/64</li>
            <li><b>PLAYLIST</b> — paint patterns into a song, add automation</li>
            <li><b>MIXER</b> — faders, sends, flanger/phaser/gate/pump…</li>
            <li><b>Export WAV</b> — share the music in your heart 💜</li>
          </ol>
          <h3>Live mode</h3>
          While playing in PAT mode, click another pattern (or press <b>1–9</b>) to queue it — it switches at the next loop, Ableton style.
        </div>
        <div>
          <h3>Keys</h3>
          <table class="help-keys">
            <tr><td>Space</td><td>play / pause</td></tr>
            <tr><td>F5 F6 F7 F8 F9</td><td>Playlist · Channels · Piano Roll · Library · Mixer</td></tr>
            <tr><td>1–9</td><td>select / queue pattern</td></tr>
            <tr><td>Z-row / Q-row</td><td>play notes (2 octaves)</td></tr>
            <tr><td>− / =</td><td>keyboard octave down / up</td></tr>
            <tr><td>● + play</td><td>record keys into the pattern</td></tr>
            <tr><td>Ctrl+Z / Ctrl+Y</td><td>undo / redo</td></tr>
            <tr><td>Ctrl+B</td><td>duplicate notes (piano roll)</td></tr>
            <tr><td>S</td><td>toggle 303 slide on selected notes</td></tr>
            <tr><td>Ctrl+S / Ctrl+O</td><td>save / open project</td></tr>
          </table>
        </div>
      </div>`;
    }, { cls: 'wide' });
  };

  // ---------------- computer keyboard ----------------
  const isTyping = () => {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  };

  const keyPitch = (k) => {
    if (KEYROW1[k] !== undefined) return kbdBase + KEYROW1[k];
    if (KEYROW2[k] !== undefined) return kbdBase + KEYROW2[k];
    return null;
  };

  window.addEventListener('keydown', async (e) => {
    if (isTyping()) return;
    const k = e.key.toLowerCase();

    // global
    if (k === ' ') { e.preventDefault(); await G.audio.init(); G.transport.toggle(); return; }
    if (e.key === 'F5') { e.preventDefault(); G.setTab('song'); return; }
    if (e.key === 'F6') { e.preventDefault(); G.setTab('steps'); return; }
    if (e.key === 'F7') { e.preventDefault(); G.setTab('piano'); return; }
    if (e.key === 'F8') { e.preventDefault(); G.setTab('library'); return; }
    if (e.key === 'F9') { e.preventDefault(); G.setTab('mixer'); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); G.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); G.redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); G.saveProjectFile(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'o') { e.preventDefault(); G.qs('.file-ops input[type=file]').click(); return; }

    // piano roll shortcuts get next crack
    if (G.views.piano && G.views.piano.handleKey && G.views.piano.handleKey(e)) return;

    // pattern select 1-9
    if (!e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (G.proj.patterns[idx]) { G.transport.queuePattern(G.proj.patterns[idx].id); }
      return;
    }

    // octave
    if (k === '-') { kbdBase = Math.max(24, kbdBase - 12); G.toast('Octave: ' + G.noteName(kbdBase)); return; }
    if (k === '=') { kbdBase = Math.min(96, kbdBase + 12); G.toast('Octave: ' + G.noteName(kbdBase)); return; }

    // notes
    const pitch = keyPitch(k);
    if (pitch != null && !e.repeat) {
      e.preventDefault();
      await G.audio.init();
      const chan = G.curChannel();
      if (!chan) return;
      heldKeys.set(k, pitch);
      G.audio.noteOn(chan, pitch, 0.85);
      highlightKbd(pitch, true);
      // record
      if (recArmed && G.transport.playing && G.transport.mode === 'pat') {
        if (!recUndoPushed) { G.undoPush('Record'); recUndoPushed = true; }
        const pat = G.curPattern();
        const posT = Math.round(G.transport.posTicks() % G.patTicks(pat));
        const snapT = Math.round(posT / (G.STEP / 2)) * (G.STEP / 2) % G.patTicks(pat);
        G.notesFor(pat, chan.id).push({ t: snapT, d: G.STEP, p: pitch, v: 0.85 });
        G.emit('notes-silent');
        if (G.sel.tab === 'piano') G.views.piano.invalidate();
        if (G.sel.tab === 'steps') G.views.steps.refresh();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    const pitch = heldKeys.get(k);
    if (pitch !== undefined) {
      heldKeys.delete(k);
      const chan = G.curChannel();
      if (chan) G.audio.noteOff(chan, pitch);
      highlightKbd(pitch, false);
    }
  });

  // ---------------- onscreen keyboard ----------------
  const buildKbd = () => {
    const kbd = G.qs('#kbd');
    kbd.innerHTML = '';
    const lo = 36, hi = 84;
    const whiteW = 26;
    let whiteIndex = 0;
    const keyEls = {};
    for (let p = lo; p <= hi; p++) {
      const black = G.isBlackKey(p);
      const el = G.el('div', 'pkey ' + (black ? 'black' : 'white'), kbd);
      el.dataset.pitch = p;
      if (!black) {
        el.style.left = (whiteIndex * whiteW) + 'px';
        whiteIndex++;
        if (p % 12 === 0) G.el('span', 'pkey-label', el, G.noteName(p));
      } else {
        el.style.left = (whiteIndex * whiteW - 8) + 'px';
      }
      keyEls[p] = el;
      const down = async (ev) => {
        ev.preventDefault();
        await G.audio.init();
        const chan = G.curChannel();
        if (!chan) return;
        G.audio.noteOn(chan, p, 0.85);
        el.classList.add('down');
      };
      const up = () => {
        const chan = G.curChannel();
        if (chan) G.audio.noteOff(chan, p);
        el.classList.remove('down');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointerenter', (ev) => { if (ev.buttons & 1) down(ev); });
    }
    kbd._keyEls = keyEls;
    kbd.style.width = (whiteIndex * whiteW + 4) + 'px';
  };

  const highlightKbd = (pitch, on) => {
    const kbd = G.qs('#kbd');
    if (!kbd || !kbd._keyEls) return;
    const el = kbd._keyEls[pitch];
    if (el) el.classList.toggle('down', on);
  };

  // ---------------- rAF loop ----------------
  const rafLoop = () => {
    // position display
    const pos = G.qs('#pos-display');
    if (pos) {
      const t = G.transport.playing ? G.transport.posTicks() : 0;
      pos.textContent = G.fmtTime(Math.floor(G.transport.mode === 'pat' && G.transport.playing ? (t % G.patTicks(G.curPattern())) : t), G.proj.bpm);
    }
    // viz
    const viz = G.qs('#viz');
    if (viz && G.audio.masterAnalyser) {
      const c = viz.getContext('2d');
      const an = G.audio.masterAnalyser;
      const data = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);
      c.clearRect(0, 0, viz.width, viz.height);
      const bars = 48;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(Math.pow(i / bars, 1.8) * data.length * 0.72);
        const v = data[idx] / 255;
        const h = Math.max(1.5, v * viz.height);
        c.fillStyle = `hsla(${186 + (i / bars) * 134},90%,${45 + v * 25}%,${0.35 + v * 0.65})`;
        c.fillRect(i * (viz.width / bars), viz.height - h, viz.width / bars - 1.5, h);
      }
    }
    // active view
    const view = G.views[G.sel.tab];
    if (view && view.tick) view.tick();
    if (G.sel.tab === 'steps' && G.views.steps) G.views.steps.tick();
    requestAnimationFrame(rafLoop);
  };

  // ---------------- boot ----------------
  const boot = async () => {
    await G.library.init();
    let restored = false;
    try { restored = G.loadAutosave(); } catch (e) {}
    if (!restored || !G.proj || !G.proj.channels.length) {
      G.proj = G.presets.demoProject();
    }
    // async-link any sampler channels from the library
    G.proj.channels.forEach(c => { if (c.kind === 'sampler') G.library.linkAsync(c); });
    G.sel.patternId = G.proj.patterns[0].id;
    G.sel.channelId = G.proj.channels[0] && G.proj.channels[0].id;

    buildTopbar();
    buildKbd();
    G.setTab('steps');
    updateModeUI();
    requestAnimationFrame(rafLoop);

    // audio unlock on first gesture
    const unlock = () => { G.audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    setInterval(() => G.autosave(), 20000);
    window.addEventListener('beforeunload', () => G.autosave());

    if (!restored) {
      setTimeout(() => G.toast('🚀 Demo song "First Flight" loaded — press SPACE to play'), 600);
      setTimeout(() => G.toast('Tip: F5 Playlist · F6 Channels · F7 Piano Roll · F8 Library · F9 Mixer'), 3200);
    }

    // notes-silent → redraw lightweight
    G.on('notes-silent', () => {
      if (G.sel.tab === 'steps') G.views.steps.refresh();
      if (G.sel.tab === 'piano' && G.views.piano) G.views.piano.invalidate();
    });
  };

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window.G);
