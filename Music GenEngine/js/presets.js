/* ============================================================
   GENENGINE — presets.js
   Instrument library: ethereal trance, chunky space-age,
   crunchy & dangerous. Plus FX chain presets and the demo song.
   ============================================================ */
'use strict';
(function (G) {

  const PR = G.presets = {};

  const syn = (over) => Object.assign(G.deepCopy(G.DEFAULT_SYNTH), over);
  const fx = (type, params) => {
    const f = G.fx.newFx(type);
    Object.assign(f.params, params || {});
    return f;
  };

  // ---------------- INSTRUMENTS ----------------
  PR.instruments = [
    // ===== BASS =====
    {
      name: 'Rolling Trance Bass', cat: 'Bass', icon: '🌀', pitch: 45,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 1, sub: 0.7, attack: 0.002, decay: 0.14, sustain: 0.25, release: 0.08, cutoff: 720, res: 2.2, fenv: 850, fdecay: 0.12, gain: 0.95 }), fx: [fx('duck', { amount: 0.85 })], sendA: 0.03 },
    },
    {
      name: 'Acid Danger 303', cat: 'Bass', icon: '☣️', pitch: 45,
      chan: { kind: 'synth', synth: syn({ engine: 'acid', wave: 'sawtooth', unison: 1, sub: 0.1, attack: 0.001, decay: 0.18, sustain: 0.12, release: 0.06, cutoff: 480, res: 11, fenv: 2600, fdecay: 0.16, glide: 0.055, gain: 0.8 }), fx: [fx('dist', { kind: 'tube', drive: 7, mix: 0.7 })], sendB: 0.12 },
    },
    {
      name: 'Chunky Space Bass', cat: 'Bass', icon: '🛰️', pitch: 40,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'square', unison: 2, detune: 8, sub: 0.6, attack: 0.003, decay: 0.2, sustain: 0.4, release: 0.1, cutoff: 900, res: 3.5, fenv: 700, fdecay: 0.18, gain: 0.85 }), fx: [fx('crush', { bits: 8, crunch: 3, mix: 0.45 }), fx('dist', { kind: 'hard', drive: 4, mix: 0.5 })] },
    },
    {
      name: 'Deep Sub 808', cat: 'Bass', icon: '🌑', pitch: 38,
      chan: { kind: 'synth', synth: syn({ engine: 'sub', wave: 'sine', unison: 1, sub: 0.4, attack: 0.004, decay: 0.5, sustain: 0.7, release: 0.2, cutoff: 300, res: 0.7, fenv: 0, gain: 1 }), fx: [fx('dist', { kind: 'tube', drive: 2.5, mix: 0.35 })] },
    },
    // ===== LEAD =====
    {
      name: 'SuperSaw Anthem', cat: 'Lead', icon: '⚡', pitch: 69,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 7, detune: 22, spread: 1, sub: 0.15, attack: 0.004, decay: 0.3, sustain: 0.75, release: 0.35, cutoff: 6200, res: 1, fenv: 1800, fdecay: 0.3, gain: 0.6 }), fx: [fx('duck', { amount: 0.6 })], sendA: 0.3, sendB: 0.22 },
    },
    {
      name: 'Ethereal Light Lead', cat: 'Lead', icon: '🕊️', pitch: 76,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 5, detune: 10, spread: 0.9, attack: 0.06, decay: 0.5, sustain: 0.6, release: 1.2, cutoff: 4200, res: 0.8, fenv: 900, fdecay: 0.6, gain: 0.5 }), fx: [fx('chorus', { mix: 0.5 })], sendA: 0.55, sendB: 0.35 },
    },
    {
      name: 'Space Age Zap', cat: 'Lead', icon: '🔫', pitch: 64,
      chan: { kind: 'synth', synth: syn({ engine: 'fm', fmRatio: 3.01, fmAmt: 1200, fmDecay: 0.2, attack: 0.001, decay: 0.25, sustain: 0.3, release: 0.15, cutoff: 9000, res: 2, fenv: 0, gain: 0.6 }), fx: [fx('phaser', { rate: 1.2, mix: 0.5 })], sendB: 0.3 },
    },
    {
      name: 'Crunchy Danger Lead', cat: 'Lead', icon: '🧨', pitch: 57,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 3, detune: 14, spread: 0.7, attack: 0.002, decay: 0.2, sustain: 0.7, release: 0.12, cutoff: 3200, res: 4, fenv: 2400, fdecay: 0.2, gain: 0.55 }), fx: [fx('crush', { bits: 5, crunch: 4, mix: 0.5 }), fx('dist', { kind: 'fuzz', drive: 9, mix: 0.55 }), fx('flanger', { rate: 0.2, feedback: 0.7, mix: 0.4 })] },
    },
    // ===== PLUCK =====
    {
      name: 'Trance Pluck', cat: 'Pluck', icon: '💠', pitch: 69,
      chan: { kind: 'synth', synth: syn({ engine: 'pluck', wave: 'sawtooth', unison: 3, detune: 9, spread: 0.8, attack: 0.001, decay: 0.16, sustain: 0, release: 0.14, cutoff: 1400, res: 1.8, fenv: 3400, fdecay: 0.12, gain: 0.7 }), sendA: 0.3, sendB: 0.42 },
    },
    {
      name: 'Crystal Bell', cat: 'Pluck', icon: '🔔', pitch: 81,
      chan: { kind: 'synth', synth: syn({ engine: 'fm', fmRatio: 3.53, fmAmt: 700, fmDecay: 0.5, attack: 0.001, decay: 0.6, sustain: 0, release: 0.7, cutoff: 12000, res: 0.5, fenv: 0, gain: 0.5 }), sendA: 0.45, sendB: 0.3 },
    },
    {
      name: 'Gated Shimmer', cat: 'Pluck', icon: '▚', pitch: 69,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 5, detune: 15, spread: 1, attack: 0.01, decay: 0.4, sustain: 0.8, release: 0.3, cutoff: 5000, res: 1, fenv: 600, gain: 0.5 }), fx: [fx('gate', { pattern: '1011010110110101', depth: 0.95 })], sendA: 0.5 },
    },
    // ===== PAD =====
    {
      name: 'Ethereal Pad', cat: 'Pad', icon: '🌫️', pitch: 64,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 5, detune: 12, spread: 1, sub: 0.2, attack: 1.1, decay: 1, sustain: 0.8, release: 2.4, cutoff: 2600, res: 0.6, fenv: 500, fattack: 0.8, fdecay: 1.5, gain: 0.42 }), fx: [fx('chorus', { rate: 0.3, mix: 0.55 })], sendA: 0.65, sendB: 0.2 },
    },
    {
      name: 'Space Choir', cat: 'Pad', icon: '👽', pitch: 60,
      chan: { kind: 'synth', synth: syn({ engine: 'fm', fmRatio: 2.001, fmAmt: 160, fmDecay: 2.5, attack: 0.9, decay: 1.5, sustain: 0.75, release: 2, cutoff: 3400, res: 0.5, fenv: 0, gain: 0.5 }), fx: [fx('chorus', { mix: 0.6 }), fx('phaser', { rate: 0.15, mix: 0.45 })], sendA: 0.7 },
    },
    {
      name: 'Dark Matter', cat: 'Pad', icon: '🕳️', pitch: 48,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 4, detune: 18, spread: 0.9, sub: 0.5, attack: 0.6, decay: 1, sustain: 0.85, release: 1.8, cutoff: 800, res: 2.5, fenv: 300, gain: 0.5 }), fx: [fx('wobble', { rate: 0.4, depth: 0.006 }), fx('dist', { kind: 'tube', drive: 3, mix: 0.3 })], sendA: 0.4 },
    },
    // ===== KEYS =====
    {
      name: 'Dream Keys', cat: 'Keys', icon: '🎹', pitch: 72,
      chan: { kind: 'synth', synth: syn({ engine: 'fm', fmRatio: 2, fmAmt: 380, fmDecay: 0.35, attack: 0.002, decay: 0.9, sustain: 0.25, release: 0.5, cutoff: 8000, res: 0.5, fenv: 0, gain: 0.55 }), fx: [fx('chorus', { mix: 0.4 })], sendA: 0.35, sendB: 0.25 },
    },
    {
      name: 'Rave Stab', cat: 'Keys', icon: '🔩', pitch: 69,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'square', unison: 3, detune: 12, spread: 0.6, attack: 0.001, decay: 0.22, sustain: 0.1, release: 0.12, cutoff: 2600, res: 3, fenv: 2000, fdecay: 0.14, gain: 0.6 }), fx: [fx('phaser', { mix: 0.35 })], sendB: 0.3 },
    },
    // ===== FX =====
    {
      name: 'Lift-Off Riser', cat: 'FX', icon: '🚀', pitch: 69,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 4, detune: 30, spread: 1, noise: 0.7, attack: 3.5, decay: 0.5, sustain: 1, release: 0.4, cutoff: 3000, res: 2, fenv: 4000, fattack: 3.5, fdecay: 1, bend: 24, bendTime: 0, gain: 0.4 }), sendA: 0.6 },
    },
    {
      name: 'Downlifter', cat: 'FX', icon: '🪂', pitch: 69,
      chan: { kind: 'synth', synth: syn({ engine: 'super', wave: 'sawtooth', unison: 3, detune: 24, spread: 1, noise: 0.8, attack: 0.02, decay: 2, sustain: 0.4, release: 1.5, cutoff: 5000, res: 1.5, fenv: -3000, fdecay: 2, bend: -24, bendTime: 0, gain: 0.4 }), sendA: 0.6 },
    },
    {
      name: 'Impact Boom', cat: 'FX', icon: '💥', pitch: 48,
      chan: { kind: 'drum', drum: { type: 'kick808' }, fx: [fx('reverb', { size: 4.5, decay: 2, mix: 0.5 })], sendA: 0.5 },
    },
  ];

  // Drum kit presets
  G.synth.DRUM_TYPES.forEach(([type, label]) => {
    PR.instruments.push({
      name: label, cat: 'Drums', icon: { kick: '🥁', kick808: '🌚', snare: '🪘', clap: '👏', hat: '🎩', openhat: '🎪', ride: '🛎️', crash: '🌊', tom: '🛢️', rim: '📍', zap: '⚡', noiseFx: '📡' }[type] || '🥁',
      pitch: 60,
      chan: { kind: 'drum', drum: { type } },
    });
  });

  PR.categories = ['Bass', 'Lead', 'Pluck', 'Pad', 'Keys', 'FX', 'Drums'];

  PR.byName = (name) => PR.instruments.find(p => p.name === name);

  PR.makeChannel = (preset) => {
    const c = G.newChannel(G.deepCopy(preset.chan));
    c.name = preset.name;
    c.id = G.uid();
    c.defPitch = preset.pitch || 60;
    (c.fx || []).forEach(f => f.id = G.uid());
    return c;
  };

  // ---------------- FX CHAIN PRESETS ----------------
  PR.fxChains = [
    { name: 'Sidechain Pump', fx: [['duck', { amount: 0.8 }]] },
    { name: 'Trance Gate 16', fx: [['gate', { pattern: '1011101110111011' }]] },
    { name: 'Crunch Bus', fx: [['dist', { kind: 'hard', drive: 6, mix: 0.6 }], ['crush', { bits: 7, mix: 0.4 }]] },
    { name: 'Ethereal Space', fx: [['chorus', { mix: 0.5 }], ['reverb', { size: 5, decay: 3, mix: 0.4 }]] },
    { name: 'Dub Echoes', fx: [['delay', { time: '3/16', feedback: 0.6, mix: 0.45 }], ['phaser', { mix: 0.3 }]] },
    { name: 'Danger Zone', fx: [['dist', { kind: 'fuzz', drive: 12, mix: 0.65 }], ['flanger', { feedback: 0.8, mix: 0.5 }], ['comp', { threshold: -20, ratio: 6 }]] },
    { name: 'Airline Filter', fx: [['filter', { type: 'lowpass', cutoff: 1200, res: 6 }]] },
    { name: 'Radio Wash', fx: [['filter', { type: 'bandpass', cutoff: 1800, res: 3 }], ['crush', { bits: 6, mix: 0.5 }]] },
  ];

  // ---------------- DEMO SONG ----------------
  PR.demoProject = () => {
    const proj = G.newProject();
    proj.name = 'First Flight';
    proj.bpm = 138;

    const mk = (presetName, over) => {
      const p = PR.byName(presetName);
      const c = PR.makeChannel(p);
      Object.assign(c, over || {});
      c.hue = G.hueFor(proj.channels.length);
      proj.channels.push(c);
      return c;
    };

    const kick = mk('Kick 909', { name: 'Kick', vol: 0.92 });
    const clap = mk('Clap', { name: 'Clap', vol: 0.6, sendA: 0.18 });
    const hat = mk('Hat Closed', { name: 'Hats', vol: 0.42, pan: 0.12 });
    const ohat = mk('Hat Open', { name: 'Open Hat', vol: 0.34, pan: -0.14, sendA: 0.1 });
    const bass = mk('Rolling Trance Bass', { name: 'Bass', vol: 0.82 });
    const acid = mk('Acid Danger 303', { name: 'Acid', vol: 0.6 });
    const pluck = mk('Trance Pluck', { name: 'Pluck', vol: 0.62 });
    const lead = mk('SuperSaw Anthem', { name: 'Anthem', vol: 0.7 });
    const pad = mk('Ethereal Pad', { name: 'Pad', vol: 0.62 });
    const riser = mk('Lift-Off Riser', { name: 'Riser', vol: 0.5 });

    // acid gets an automatable filter for the sweep
    const acidFilter = fx('filter', { type: 'lowpass', cutoff: 1400, res: 4 });
    acid.fx.push(acidFilter);

    proj.patterns = [];
    const S = G.STEP;   // 24 ticks per 1/16
    const note = (t, d, p2, v, s) => ({ t, d, p: p2, v: v === undefined ? 0.85 : v, s: !!s });
    const stepSeq = (str, pitch, vAccent, vNorm) =>
      str.split('').map((c, i) => c === '1' ? note(i * S, S - 4, pitch, (i % 4 === 0 ? (vAccent || 0.95) : (vNorm || 0.7))) : null).filter(Boolean);

    // P1 — Drums Core (1 bar)
    const p1 = G.newPattern('Drums Core', 1); p1.hue = 4;
    p1.notes[kick.id] = stepSeq('1000100010001000', 60, 1, 1);
    p1.notes[clap.id] = stepSeq('0000100000001000', 60, 0.9, 0.9);
    p1.notes[hat.id] = stepSeq('1010101010101010', 60, 0.55, 0.4);
    p1.notes[ohat.id] = stepSeq('0010001000100010', 60, 0.7, 0.7);
    proj.patterns.push(p1);

    // P2 — Kick & Hats only (intro, 1 bar)
    const p2 = G.newPattern('Kick+Hats', 1); p2.hue = 24;
    p2.notes[kick.id] = stepSeq('1000100010001000', 60, 1, 1);
    p2.notes[hat.id] = stepSeq('0010001000100010', 60, 0.5, 0.5);
    proj.patterns.push(p2);

    // P3 — Rolling Bass (4 bars: Am Am F G)
    const p3 = G.newPattern('Rolling Bass', 4); p3.hue = 205;
    const bassNotes = [];
    const roots = [45, 45, 41, 43];   // A1(+12=45 is A2… use A1=33? choose 45=A2 punchy) — A2 A2 F2 G2
    roots.forEach((root, bar) => {
      for (let beat = 0; beat < 4; beat++) {
        [1, 2, 3].forEach((sixteenth, idx) => {
          bassNotes.push(note(bar * G.BAR + beat * G.PPQ + sixteenth * S, S - 5, root, idx === 1 ? 0.62 : 0.8));
        });
      }
    });
    p3.notes[bass.id] = bassNotes;
    proj.patterns.push(p3);

    // P4 — Acid Line (2 bars)
    const p4 = G.newPattern('Acid Line', 2); p4.hue = 90;
    const acidSteps = [
      [0, 45, 0.9, 0], [2, 45, 0.6, 0], [3, 57, 0.85, 1], [4, 45, 0.7, 0], [6, 48, 0.85, 0], [7, 45, 0.5, 1],
      [8, 45, 0.9, 0], [10, 52, 0.8, 1], [11, 45, 0.6, 0], [12, 43, 0.85, 0], [14, 45, 0.7, 0], [15, 55, 0.9, 1],
      [16, 45, 0.9, 0], [18, 45, 0.6, 0], [19, 57, 0.85, 1], [20, 45, 0.7, 0], [22, 48, 0.85, 0], [23, 45, 0.5, 1],
      [24, 45, 0.9, 0], [26, 52, 0.8, 1], [27, 45, 0.6, 0], [28, 43, 0.85, 0], [29, 45, 0.6, 0], [30, 55, 0.9, 1], [31, 57, 0.95, 1],
    ];
    p4.notes[acid.id] = acidSteps.map(([st, p5, v, s]) => note(st * S, S - 3, p5, v, !!s));
    proj.patterns.push(p4);

    // P5 — Pluck Arp (2 bars, Am arpeggio 1/16)
    const p5 = G.newPattern('Pluck Arp', 2); p5.hue = 265;
    const arpNotes = [];
    const arpSets = [[57, 60, 64, 69], [57, 60, 64, 72]];
    for (let bar = 0; bar < 2; bar++) {
      const set = arpSets[bar];
      for (let i = 0; i < 16; i++) {
        const p6 = set[i % 4] + (i % 8 >= 4 ? 12 : 0);
        arpNotes.push(note(bar * G.BAR + i * S, S - 6, p6, 0.5 + 0.35 * ((i % 4) === 0 ? 1 : 0.4) + (i % 2) * 0.08));
      }
    }
    p5.notes[pluck.id] = arpNotes;
    proj.patterns.push(p5);

    // P6 — Anthem Lead (4 bars)
    const p6 = G.newPattern('Anthem', 4); p6.hue = 320;
    const E = G.PPQ / 2;  // eighth
    const mel = [
      // bar 1 (Am): A E' C' A E' C' B C'
      [0, 69], [1, 76], [2, 72], [3, 69], [4, 76], [5, 72], [6, 71], [7, 72],
      // bar 2: A E' C' A G' E' D' E'
      [8, 69], [9, 76], [10, 72], [11, 69], [12, 79], [13, 76], [14, 74], [15, 76],
      // bar 3 (F): F C' A F D' C' B C'? use F A C' F...
      [16, 65], [17, 72], [18, 69], [19, 65], [20, 72], [21, 69], [22, 67], [23, 69],
      // bar 4 (G): G D' B G B D' E' F'?
      [24, 67], [25, 74], [26, 71], [27, 67], [28, 71], [29, 74], [30, 76], [31, 79],
    ];
    p6.notes[lead.id] = mel.map(([i, p7]) => note(i * E, E - 6, p7, 0.8 + (i % 2 ? 0 : 0.12)));
    proj.patterns.push(p6);

    // P7 — Pad (4 bars: Am F C G)
    const p7 = G.newPattern('Ethereal Pad', 4); p7.hue = 186;
    const chords = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
    const padNotes = [];
    chords.forEach((ch, bar) => ch.forEach(p8 => padNotes.push(note(bar * G.BAR, G.BAR - 10, p8, 0.75))));
    p7.notes[pad.id] = padNotes;
    proj.patterns.push(p7);

    // P8 — Riser (4 bars)
    const p8 = G.newPattern('Riser', 4); p8.hue = 45;
    p8.notes[riser.id] = [note(0, G.BAR * 4 - 12, 69, 0.85)];
    proj.patterns.push(p8);

    // ---------- automation: acid filter sweep ----------
    const sweep = {
      id: G.uid(), name: 'Acid Sweep',
      target: { ch: acid.id, param: 'fx:' + acidFilter.id + ':cutoff' },
      points: [{ t: 0, v: 0.25 }, { t: 0.7, v: 0.65 }, { t: 1, v: 0.95 }],
    };
    proj.automations.push(sweep);

    // ---------- playlist ----------
    const B = G.BAR;
    const clip = (patId, t, d) => ({ id: G.uid(), type: 'pat', patId, t, d });
    const tr = proj.playlist.tracks;
    tr[0].name = 'Drums';
    tr[1].name = 'Bass';
    tr[2].name = 'Acid';
    tr[3].name = 'Pluck';
    tr[4].name = 'Lead';
    tr[5].name = 'Pad';
    tr[6].name = 'FX';
    tr[7].name = 'Automation';

    // Intro (bars 1–4): kick+hats, bass
    tr[0].clips.push(clip(p2.id, 0, 4 * B));
    tr[1].clips.push(clip(p3.id, 0, 4 * B));
    // Build (5–12): full drums, bass, acid, pluck
    tr[0].clips.push(clip(p1.id, 4 * B, 8 * B));
    tr[1].clips.push(clip(p3.id, 4 * B, 8 * B));
    tr[2].clips.push(clip(p4.id, 4 * B, 8 * B));
    tr[3].clips.push(clip(p5.id, 8 * B, 4 * B));
    // Riser into drop (9–12)
    tr[6].clips.push(clip(p8.id, 8 * B, 4 * B));
    // acid sweep across build
    tr[7].clips.push({ id: G.uid(), type: 'auto', autoId: sweep.id, t: 4 * B, d: 8 * B });
    // DROP (13–20): everything
    tr[0].clips.push(clip(p1.id, 12 * B, 8 * B));
    tr[1].clips.push(clip(p3.id, 12 * B, 8 * B));
    tr[3].clips.push(clip(p5.id, 12 * B, 8 * B));
    tr[4].clips.push(clip(p6.id, 12 * B, 8 * B));
    tr[5].clips.push(clip(p7.id, 12 * B, 8 * B));
    // Outro (21–24): pad + pluck fade
    tr[5].clips.push(clip(p7.id, 20 * B, 4 * B));
    tr[3].clips.push(clip(p5.id, 20 * B, 4 * B));

    proj.loop = { on: true, a: 0, b: 24 * B };
    return proj;
  };

})(window.G);
