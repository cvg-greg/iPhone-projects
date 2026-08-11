/* ============================================================
   GENENGINE — state.js
   Project data model, selection, undo/redo, save/load.

   Timing: 96 ticks per quarter (PPQ). Bar = 384 ticks.
   Note: { t: startTick, d: durTicks, p: midiPitch, v: vel 0..1, s: slide? }
   ============================================================ */
'use strict';
(function (G) {

  // ---------- factories ----------
  G.newChannel = (opts) => Object.assign({
    id: G.uid(),
    name: 'Channel',
    kind: 'synth',            // 'synth' | 'drum' | 'sampler'
    synth: G.deepCopy(G.DEFAULT_SYNTH),
    drum: { type: 'kick' },   // used when kind === 'drum'
    sample: null,             // { name, base64?, buffer(runtime) } when kind === 'sampler'
    samp: { root: 60, start: 0, end: 1, loop: false, attack: 0.001, release: 0.08, gain: 1 },
    vol: 0.8, pan: 0, mute: false, solo: false,
    pitch: 0,                 // semitones, automatable, drives all voices
    fx: [],                   // [{id, type, on, params:{}}]
    sendA: 0, sendB: 0,       // reverb / delay send levels
    hue: 186,
  }, opts || {});

  G.DEFAULT_SYNTH = {
    engine: 'super',          // 'super'|'acid'|'fm'|'pluck'|'sub'|'noise'
    wave: 'sawtooth', unison: 5, detune: 18, spread: 0.8,
    sub: 0.25, noise: 0,
    attack: 0.005, decay: 0.25, sustain: 0.6, release: 0.3,
    cutoff: 4500, res: 1.2, fenv: 2400, fattack: 0.002, fdecay: 0.3,
    glide: 0, fmRatio: 2, fmAmt: 300, fmDecay: 0.4,
    gain: 0.8,
  };

  G.newPattern = (name, bars) => ({
    id: G.uid(),
    name: name || 'Pattern',
    bars: bars || 1,          // length in bars
    notes: {},                // channelId -> [Note]
    hue: G.hueFor(Math.floor(Math.random() * 16)),
  });

  G.newProject = () => ({
    fmt: 1,
    name: 'Untitled Flight',
    bpm: 138, swing: 0,
    masterVol: 0.85,
    masterFx: [],
    sendAFx: { size: 3.2, decay: 3.5, tone: 5200, mix: 1 },   // global space reverb
    sendBFx: { time: '3/16', feedback: 0.42, tone: 3800, mix: 1 }, // global sync delay
    channels: [],
    patterns: [G.newPattern('Pattern 1')],
    playlist: { tracks: Array.from({ length: 12 }, (_, i) => ({ name: 'Track ' + (i + 1), clips: [] })) },
    // clip: {id, type:'pat'|'auto', patId?, autoId?, t: startTick, d: durTicks}
    automations: [],          // {id, name, target:{ch, param}, points:[{t (0..1 of clip), v (0..1)}]}
    loop: { on: true, a: 0, b: G.BAR * 8 },
  });

  // ---------- current state ----------
  G.proj = null;
  G.sel = {
    patternId: null,          // current pattern (channel rack / piano roll)
    channelId: null,          // current channel (piano roll / keyboard target)
    tab: 'steps',
  };

  G.curPattern = () => G.proj.patterns.find(p => p.id === G.sel.patternId) || G.proj.patterns[0];
  G.curChannel = () => G.proj.channels.find(c => c.id === G.sel.channelId) || G.proj.channels[0];
  G.chanById = (id) => G.proj.channels.find(c => c.id === id);
  G.patById = (id) => G.proj.patterns.find(p => p.id === id);
  G.autoById = (id) => G.proj.automations.find(a => a.id === id);
  G.notesFor = (pat, chanId) => (pat.notes[chanId] = pat.notes[chanId] || []);

  // Length of pattern in ticks (auto-grows with content)
  G.patTicks = (pat) => pat.bars * G.BAR;
  G.patAutoGrow = (pat) => {
    let maxT = 0;
    Object.values(pat.notes).forEach(arr => arr.forEach(n => { maxT = Math.max(maxT, n.t + n.d); }));
    const need = Math.max(1, Math.ceil(maxT / G.BAR));
    if (need > pat.bars) pat.bars = need;
  };

  G.songTicks = () => {
    let max = G.BAR * 4;
    G.proj.playlist.tracks.forEach(tr => tr.clips.forEach(c => { max = Math.max(max, c.t + c.d); }));
    return max;
  };

  // ---------- mutations ----------
  G.addChannel = (opts, skipUndo) => {
    if (!skipUndo) G.undoPush('Add channel');
    const ch = G.newChannel(opts);
    ch.hue = G.hueFor(G.proj.channels.length);
    G.proj.channels.push(ch);
    G.sel.channelId = ch.id;
    G.emit('channels');
    return ch;
  };

  G.removeChannel = (id) => {
    G.undoPush('Delete channel');
    const i = G.proj.channels.findIndex(c => c.id === id);
    if (i >= 0) G.proj.channels.splice(i, 1);
    G.proj.patterns.forEach(p => delete p.notes[id]);
    if (G.sel.channelId === id) G.sel.channelId = G.proj.channels[0] && G.proj.channels[0].id;
    G.audio && G.audio.dropChannelGraph(id);
    G.emit('channels'); G.emit('notes');
  };

  G.addPattern = (name) => {
    G.undoPush('Add pattern');
    const p = G.newPattern(name || 'Pattern ' + (G.proj.patterns.length + 1));
    G.proj.patterns.push(p);
    G.sel.patternId = p.id;
    G.emit('patterns');
    return p;
  };

  G.clonePattern = (id) => {
    G.undoPush('Clone pattern');
    const src = G.patById(id); if (!src) return;
    const p = G.deepCopy(src); p.id = G.uid(); p.name = src.name + ' copy';
    G.proj.patterns.push(p); G.sel.patternId = p.id;
    G.emit('patterns');
    return p;
  };

  G.removePattern = (id) => {
    if (G.proj.patterns.length <= 1) { G.toast('Cannot delete the last pattern'); return; }
    G.undoPush('Delete pattern');
    G.proj.patterns = G.proj.patterns.filter(p => p.id !== id);
    G.proj.playlist.tracks.forEach(tr => { tr.clips = tr.clips.filter(c => c.patId !== id); });
    if (G.sel.patternId === id) G.sel.patternId = G.proj.patterns[0].id;
    G.emit('patterns'); G.emit('playlist');
  };

  // ---------- undo ----------
  const undoStack = [], redoStack = [];
  const snapshot = () => JSON.stringify(G.serialize(false));
  G.undoPush = (label) => {
    undoStack.push({ label, data: snapshot() });
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  };
  // capture/commit pair for drag gestures: capture BEFORE mutating,
  // commit at gesture end only if something actually changed
  G.undoCapture = () => snapshot();
  G.undoCommit = (label, data) => {
    if (data === snapshot()) return;
    undoStack.push({ label, data });
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  };
  const restore = (data) => {
    const keepSamples = {};
    G.proj.channels.forEach(c => { if (c.sample && c.sample.buffer) keepSamples[c.id] = c.sample; });
    G.loadProjectData(JSON.parse(data), keepSamples);
  };
  G.undo = () => {
    if (!undoStack.length) { G.toast('Nothing to undo'); return; }
    redoStack.push({ label: 'redo', data: snapshot() });
    restore(undoStack.pop().data);
    G.toast('Undo');
  };
  G.redo = () => {
    if (!redoStack.length) { G.toast('Nothing to redo'); return; }
    undoStack.push({ label: 'undo', data: snapshot() });
    restore(redoStack.pop().data);
    G.toast('Redo');
  };

  // ---------- serialize / load ----------
  G.serialize = (includeSamples) => {
    const p = JSON.parse(JSON.stringify(G.proj, (k, v) => (k === 'buffer' ? undefined : v)));
    if (!includeSamples) p.channels.forEach(c => { if (c.sample) c.sample = { name: c.sample.name }; });
    return p;
  };

  G.loadProjectData = (data, keepSamples) => {
    G.proj = data;
    // re-attach runtime sample buffers where possible
    G.proj.channels.forEach(c => {
      if (keepSamples && keepSamples[c.id]) c.sample = keepSamples[c.id];
      else if (c.sample && c.sample.name && G.library) {
        const buf = G.library.bufferByName(c.sample.name);
        if (buf) c.sample.buffer = buf;
      }
    });
    if (!G.patById(G.sel.patternId)) G.sel.patternId = G.proj.patterns[0] && G.proj.patterns[0].id;
    if (!G.chanById(G.sel.channelId)) G.sel.channelId = G.proj.channels[0] && G.proj.channels[0].id;
    G.audio && G.audio.rebuildAll();
    G.emit('project'); G.emit('channels'); G.emit('patterns'); G.emit('notes'); G.emit('playlist'); G.emit('mixer');
  };

  // ---------- save / open ----------
  G.saveProjectFile = async () => {
    const data = G.serialize(true);
    // embed sample audio as base64 wav so projects are portable
    for (const c of G.proj.channels) {
      if (c.kind === 'sampler' && c.sample && c.sample.buffer && !c.sample.base64) {
        try {
          const b = c.sample.buffer;
          const chans = [b.getChannelData(0), b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)];
          const blob = G.encodeWav(chans, b.sampleRate);
          const b64 = await blobToB64(blob);
          const dc = data.channels.find(x => x.id === c.id);
          if (dc) dc.sample = { name: c.sample.name, base64: b64 };
        } catch (e) { console.warn('sample embed failed', e); }
      }
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    G.download(blob, (G.proj.name || 'project').replace(/[^\w\- ]+/g, '') + '.genengine.json');
    G.toast('Project saved 💾');
  };

  const blobToB64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

  G.openProjectFile = (file) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.channels || !data.patterns) throw new Error('Not a GenEngine project');
        // decode embedded samples
        for (const c of data.channels) {
          if (c.sample && c.sample.base64) {
            try {
              const bin = atob(c.sample.base64);
              const arr = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              await G.audio.init();
              c.sample.buffer = await G.audio.ctx.decodeAudioData(arr.buffer);
              delete c.sample.base64;
            } catch (e) { console.warn('sample decode failed', e); }
          }
        }
        G.transport && G.transport.stop();
        G.loadProjectData(data);
        G.toast('Project loaded: ' + (data.name || 'Untitled'));
      } catch (e) { console.error(e); G.toast('Could not open project: ' + e.message, 'err'); }
    };
    r.readAsText(file);
  };

  // ---------- autosave ----------
  G.autosave = () => {
    try { localStorage.setItem('genengine.autosave', JSON.stringify(G.serialize(false))); } catch (e) { /* quota */ }
  };
  G.loadAutosave = () => {
    try {
      const s = localStorage.getItem('genengine.autosave');
      if (!s) return false;
      G.loadProjectData(JSON.parse(s));
      return true;
    } catch (e) { return false; }
  };

})(window.G);
