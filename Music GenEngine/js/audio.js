/* ============================================================
   GENENGINE — audio.js
   The heart: AudioContext, master chain, send buses, channel
   strips, lookahead transport scheduler (pattern & song mode),
   swing, live pattern queueing, automation, metronome,
   live keyboard voices, offline WAV export.
   ============================================================ */
'use strict';
(function (G) {

  const A = G.audio = {};
  A.ctx = null;

  // ======================================================
  // GRAPH BUILDERS (ctx-agnostic: used for realtime + export)
  // ======================================================

  const buildMaster = (ctx, proj) => {
    const input = ctx.createGain();
    const chain = G.fx.buildChain(ctx, proj.masterFx, proj.bpm);
    const vol = ctx.createGain(); vol.gain.value = proj.masterVol;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    input.connect(chain.input); chain.output.connect(vol); vol.connect(limiter);
    return { input, chain, vol, limiter, out: limiter };
  };

  const buildBuses = (ctx, proj, masterIn) => {
    // Send A — global space reverb
    const rIn = ctx.createGain();
    const conv = ctx.createConvolver();
    const rp = proj.sendAFx;
    conv.buffer = G.fx.makeIR(ctx, rp.size, rp.decay, rp.tone);
    const rOut = ctx.createGain(); rOut.gain.value = rp.mix;
    rIn.connect(conv); conv.connect(rOut); rOut.connect(masterIn);
    // Send B — global sync delay (ping-pong)
    const dIn = ctx.createGain();
    const dp = proj.sendBFx;
    const dL = ctx.createDelay(4), dR = ctx.createDelay(4);
    const fb = ctx.createGain(), tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
    const merger = ctx.createChannelMerger(2);
    const t = G.fx.syncToSec(dp.time, proj.bpm);
    dL.delayTime.value = t; dR.delayTime.value = t;
    fb.gain.value = dp.feedback; tone.frequency.value = dp.tone;
    const dOut = ctx.createGain(); dOut.gain.value = dp.mix;
    dIn.connect(dL);
    dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
    dL.connect(fb); fb.connect(tone); tone.connect(dR); dR.connect(dL);
    merger.connect(dOut); dOut.connect(masterIn);
    return {
      revIn: rIn, delIn: dIn,
      retune(bpm) { const tt = G.fx.syncToSec(proj.sendBFx.time, bpm); dL.delayTime.value = tt; dR.delayTime.value = tt; },
      refresh() {
        const p2 = proj.sendAFx;
        conv.buffer = G.fx.makeIR(ctx, p2.size, p2.decay, p2.tone);
        rOut.gain.value = p2.mix;
        const p3 = proj.sendBFx;
        const tt = G.fx.syncToSec(p3.time, proj.bpm);
        dL.delayTime.value = tt; dR.delayTime.value = tt;
        fb.gain.value = p3.feedback; tone.frequency.value = p3.tone; dOut.gain.value = p3.mix;
      },
    };
  };

  const buildStrip = (ctx, chan, proj, master, buses, withAnalyser) => {
    const input = ctx.createGain();
    const chain = G.fx.buildChain(ctx, chan.fx, proj.bpm);
    const vol = ctx.createGain();
    const muteG = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    input.connect(chain.input); chain.output.connect(vol); vol.connect(muteG); muteG.connect(pan);
    pan.connect(master.input);
    const sendA = ctx.createGain(), sendB = ctx.createGain();
    muteG.connect(sendA); sendA.connect(buses.revIn);
    muteG.connect(sendB); sendB.connect(buses.delIn);
    let analyser = null;
    if (withAnalyser) {
      analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      pan.connect(analyser);
    }
    const strip = { chanId: chan.id, input, chain, vol, muteG, pan, sendA, sendB, analyser };
    strip.apply = () => {
      vol.gain.value = chan.vol * chan.vol * 1.4;   // audio-taper
      if (pan.pan) pan.pan.value = chan.pan;
      strip.applyMute();
      sendA.gain.value = chan.sendA; sendB.gain.value = chan.sendB;
    };
    strip.applyMute = () => {
      const anySolo = proj.channels.some(c => c.solo);
      const audible = !chan.mute && (!anySolo || chan.solo);
      muteG.gain.value = audible ? 1 : 0;
    };
    strip.apply();
    return strip;
  };

  // ======================================================
  // REALTIME ENGINE
  // ======================================================
  A.strips = new Map();
  A.master = null; A.buses = null;
  let masterAnalyser = null;
  A.ready = false;

  A.init = async () => {
    if (A.ready) return;
    A.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (A.ctx.state === 'suspended') { try { await A.ctx.resume(); } catch (e) {} }
    A.rebuildAll();
    A.ready = true;
    G.emit('audio-ready');
  };

  A.rebuildAll = () => {
    if (!A.ctx) return;
    A.stopAllVoices();
    if (A.master) { try { A.master.out.disconnect(); } catch (e) {} try { A.master.chain.dispose(); } catch (e) {} }
    A.strips.forEach(s => { try { s.chain.dispose(); } catch (e) {} try { s.pan.disconnect(); } catch (e) {} });
    A.strips.clear();
    A.master = buildMaster(A.ctx, G.proj);
    masterAnalyser = A.ctx.createAnalyser(); masterAnalyser.fftSize = 2048;
    A.master.out.connect(masterAnalyser);
    masterAnalyser.connect(A.ctx.destination);
    A.masterAnalyser = masterAnalyser;
    A.buses = buildBuses(A.ctx, G.proj, A.master.input);
    G.proj.channels.forEach(ch => A.ensureStrip(ch));
  };

  A.ensureStrip = (chan) => {
    if (!A.ctx) return null;
    let s = A.strips.get(chan.id);
    if (!s) { s = buildStrip(A.ctx, chan, G.proj, A.master, A.buses, true); A.strips.set(chan.id, s); }
    return s;
  };

  A.rebuildStrip = (chan) => {
    if (!A.ctx) return;
    const old = A.strips.get(chan.id);
    if (old) {
      try { old.chain.dispose(); } catch (e) {}
      try { old.input.disconnect(); old.pan.disconnect(); old.muteG.disconnect(); old.sendA.disconnect(); old.sendB.disconnect(); } catch (e) {}
      A.strips.delete(chan.id);
    }
    A.ensureStrip(chan);
  };

  A.dropChannelGraph = (id) => {
    const old = A.strips.get(id);
    if (old) {
      try { old.chain.dispose(); old.input.disconnect(); old.pan.disconnect(); } catch (e) {}
      A.strips.delete(id);
    }
  };

  A.applyChanParams = (chan) => { const s = A.strips.get(chan.id); if (s) s.apply(); };
  A.applyAllMutes = () => { A.strips.forEach(s => { const c = G.chanById(s.chanId); if (c) s.applyMute(); }); };
  A.updateFx = (chan, fx) => {
    const s = A.strips.get(chan.id);
    if (!s || !s.chain.update(fx, G.proj.bpm)) A.rebuildStrip(chan);
  };
  A.updateMasterFx = (fx) => {
    if (!A.master || !A.master.chain.update(fx, G.proj.bpm)) A.rebuildAll();
  };
  A.setMasterVol = (v) => { if (A.master) A.master.vol.gain.value = v; };
  A.refreshBuses = () => { if (A.buses) A.buses.refresh(); };

  A.refreshTempo = () => {
    if (!A.ctx) return;
    const bpm = G.proj.bpm;
    if (A.buses) A.buses.retune(bpm);
    G.proj.channels.forEach(ch => {
      const s = A.strips.get(ch.id);
      if (!s) return;
      ch.fx.forEach(fx => { if (G.fx.defs[fx.type] && G.fx.defs[fx.type].tempo) s.chain.update(fx, bpm); });
    });
    G.proj.masterFx.forEach(fx => { if (G.fx.defs[fx.type] && G.fx.defs[fx.type].tempo && A.master) A.master.chain.update(fx, bpm); });
  };

  // channel pitch live-update on sustained voices
  A.setChanPitch = (chan, semis) => {
    chan.pitch = semis;
    activeVoices.forEach(v => {
      if (v._chanId !== chan.id || !v.detunables) return;
      v.detunables.forEach(o => {
        try { o.detune.value = (o._baseDetune || 0) + (semis - (v._schedPitch || 0)) * 100; } catch (e) {}
      });
    });
  };

  // ---------- voices ----------
  let activeVoices = [];
  const liveKeys = new Map();   // chanId:pitch -> voice

  const trackVoice = (v, chan) => {
    if (!v) return v;
    v._chanId = chan.id; v._schedPitch = chan.pitch || 0;
    activeVoices.push(v);
    if (activeVoices.length > 200) { activeVoices = activeVoices.filter(x => !x.released); }
    return v;
  };

  A.noteOn = (chan, pitch, vel) => {
    if (!A.ctx) return;
    const s = A.ensureStrip(chan);
    const key = chan.id + ':' + pitch;
    if (liveKeys.has(key)) return;
    const v = G.synth.play(A.ctx, s.input, chan, { pitch, vel: vel || 0.85, t: A.ctx.currentTime + 0.002, dur: null });
    if (v) { liveKeys.set(key, v); trackVoice(v, chan); }
  };

  A.noteOff = (chan, pitch) => {
    const key = chan.id + ':' + pitch;
    const v = liveKeys.get(key);
    if (v) { v.release(A.ctx.currentTime); liveKeys.delete(key); }
  };

  A.previewNote = (chan, pitch, durSec) => {
    if (!A.ctx) return;
    const s = A.ensureStrip(chan);
    const v = G.synth.play(A.ctx, s.input, chan, { pitch, vel: 0.9, t: A.ctx.currentTime + 0.002, dur: durSec || 0.4 });
    trackVoice(v, chan);
  };

  A.previewPreset = (presetChanObj, pitch, durSec) => {
    if (!A.ctx || !A.master) return;
    const v = G.synth.play(A.ctx, A.master.input, presetChanObj, { pitch: pitch || 60, vel: 0.9, t: A.ctx.currentTime + 0.002, dur: durSec || 0.5 });
  };

  A.previewBuffer = (buffer) => {
    if (!A.ctx || !A.master) return null;
    const src = A.ctx.createBufferSource(); src.buffer = buffer;
    const g = A.ctx.createGain(); g.gain.value = 0.9;
    src.connect(g); g.connect(A.master.input);
    src.start();
    return src;
  };

  A.stopAllVoices = () => {
    activeVoices.forEach(v => { try { v.kill(); } catch (e) {} });
    activeVoices = [];
    liveKeys.clear();
  };

  // ======================================================
  // SCHEDULING CORE (shared by realtime + offline export)
  // ======================================================
  // graph = {ctx, stripFor(chanId), master, metronome:boolean}
  // Schedules all notes/bars/automation with ticks in [a, b)
  // where tick a occurs at absolute ctx time tA. spt = sec/tick.

  const collectSongEvents = (proj, a, b, emitNote, emitAutoSeg) => {
    proj.playlist.tracks.forEach(tr => {
      tr.clips.forEach(clip => {
        if (clip.t >= b || clip.t + clip.d <= a) return;
        if (clip.type === 'pat') {
          const pat = proj.patterns.find(p => p.id === clip.patId);
          if (!pat) return;
          const patLen = G.patTicks(pat);
          Object.keys(pat.notes).forEach(chId => {
            pat.notes[chId].forEach(n => {
              // pattern repeats within clip length
              for (let rep = 0; rep * patLen < clip.d; rep++) {
                const t = clip.t + rep * patLen + n.t;
                if (t >= clip.t + clip.d) break;
                if (t >= a && t < b) {
                  const d = Math.min(n.d, clip.t + clip.d - t);
                  emitNote(chId, n, t, d, pat, rep * patLen + clip.t);
                }
              }
            });
          });
        } else if (clip.type === 'auto') {
          emitAutoSeg && emitAutoSeg(clip, a, b);
        }
      });
    });
  };

  const autoValue = (auto, frac) => {
    const pts = auto.points;
    if (!pts.length) return 0.5;
    if (frac <= pts[0].t) return pts[0].v;
    for (let i = 0; i < pts.length - 1; i++) {
      if (frac >= pts[i].t && frac <= pts[i + 1].t) {
        const span = pts[i + 1].t - pts[i].t || 1e-9;
        return G.lerp(pts[i].v, pts[i + 1].v, (frac - pts[i].t) / span);
      }
    }
    return pts[pts.length - 1].v;
  };
  A.autoValue = autoValue;

  // resolve automation target -> {param | fn, min, max}
  const resolveTarget = (graph, target) => {
    if (!target) return null;
    if (target.ch === 'master') {
      if (target.param === 'vol') return { param: graph.master.vol.gain, min: 0, max: 1.2 };
      return null;
    }
    const chan = G.chanById(target.ch);
    const strip = chan && graph.stripFor(target.ch);
    if (!chan || !strip) return null;
    switch (target.param) {
      case 'vol': return { param: strip.vol.gain, min: 0, max: 1.4 };
      case 'pan': return strip.pan.pan ? { param: strip.pan.pan, min: -1, max: 1 } : null;
      case 'sendA': return { param: strip.sendA.gain, min: 0, max: 1 };
      case 'sendB': return { param: strip.sendB.gain, min: 0, max: 1 };
      case 'pitch': return { noteOfs: true, min: -24, max: 24 };
      default:
        if (target.param.startsWith('fx:')) {
          const [, fxId, key] = target.param.split(':');
          const inst = strip.chain.insts.find(i => i._fxId === fxId);
          if (inst && inst.auto && inst.auto[key]) {
            const p = inst.auto[key]();
            if (key === 'cutoff') return { param: p, min: 60, max: 15000, curve: 'exp' };
            if (key === 'res') return { param: p, min: 0.1, max: 20 };
          }
        }
        return null;
    }
  };

  // pitch-offset automation lookup at a tick (schedule-time application)
  const pitchAutoAt = (proj, chanId, tick) => {
    let ofs = 0;
    proj.playlist.tracks.forEach(tr => tr.clips.forEach(clip => {
      if (clip.type !== 'auto' || tick < clip.t || tick >= clip.t + clip.d) return;
      const auto = proj.automations.find(x => x.id === clip.autoId);
      if (!auto || auto.target.ch !== chanId || auto.target.param !== 'pitch') return;
      const v = autoValue(auto, (tick - clip.t) / clip.d);
      ofs += (v - 0.5) * 48;   // ±24 semis
    }));
    return ofs;
  };

  const scheduleRange = (graph, proj, mode, patId, a, b, tA, spt, opts) => {
    opts = opts || {};
    const swing = proj.swing || 0;
    const swingOfs = (t) => ((Math.floor(t / G.STEP) % 2) === 1 ? swing * G.STEP * 0.5 * spt : 0);
    const timeOf = (tick) => tA + (tick - a) * spt;

    const fire = (chId, n, tick, d, srcPat) => {
      const chan = proj.channels.find(c => c.id === chId);
      if (!chan) return;
      const strip = graph.stripFor(chId);
      if (!strip) return;
      const t = timeOf(tick) + swingOfs(n.t);
      const pofs = opts.songAuto ? pitchAutoAt(proj, chId, tick) : 0;
      // acid slide: find previous overlapping/adjacent note in same pattern channel
      let slideFrom = null;
      if (n.s && srcPat) {
        const arr = srcPat.notes[chId] || [];
        let best = null;
        arr.forEach(m => { if (m !== n && m.t < n.t && (!best || m.t > best.t)) best = m; });
        if (best && n.t - (best.t + best.d) <= G.STEP) slideFrom = best.p;
      }
      const v = G.synth.play(graph.ctx, strip.input, chan, {
        pitch: n.p, vel: n.v, t, dur: Math.max(1, d) * spt, slideFrom, pitchOfs: pofs,
      });
      if (graph.track && v) trackVoice(v, chan);
    };

    if (mode === 'pat') {
      const pat = proj.patterns.find(p => p.id === patId);
      if (pat) {
        Object.keys(pat.notes).forEach(chId => {
          pat.notes[chId].forEach(n => { if (n.t >= a && n.t < b) fire(chId, n, n.t, n.d, pat); });
        });
      }
    } else {
      collectSongEvents(proj, a, b, (chId, n, t, d, pat) => fire(chId, n, t, d, pat),
        (clip, wa, wb) => {
          // schedule automation ramps at 1/32-note resolution
          const auto = proj.automations.find(x => x.id === clip.autoId);
          if (!auto) return;
          const tgt = resolveTarget(graph, auto.target);
          if (!tgt || tgt.noteOfs) return;
          const res = 12; // ticks
          const start = Math.max(wa, clip.t), end = Math.min(wb, clip.t + clip.d);
          for (let tick = Math.ceil(start / res) * res; tick < end; tick += res) {
            const v01 = autoValue(auto, (tick - clip.t) / clip.d);
            let val = tgt.curve === 'exp'
              ? tgt.min * Math.pow(tgt.max / tgt.min, v01)
              : tgt.min + (tgt.max - tgt.min) * v01;
            try { tgt.param.linearRampToValueAtTime(val, timeOf(tick)); } catch (e) {}
            if (graph.autoParams) graph.autoParams.add(tgt.param);
          }
        });
    }

    // bar-boundary hooks (sidechain pump, trance gate) + metronome
    const firstBar = Math.ceil(a / G.BAR) * G.BAR;
    for (let barTick = firstBar; barTick < b; barTick += G.BAR) {
      const t = timeOf(barTick);
      proj.channels.forEach(ch => {
        const strip = graph.stripFor(ch.id);
        if (strip) strip.chain.onBar(t, proj.bpm, ch.fx);
      });
      graph.master.chain.onBar(t, proj.bpm, proj.masterFx);
    }
    if (graph.metronome && T.metronome) {
      const firstBeat = Math.ceil(a / G.PPQ) * G.PPQ;
      for (let bt = firstBeat; bt < b; bt += G.PPQ) {
        const isBar = bt % G.BAR === 0;
        const t = timeOf(bt);
        const o = graph.ctx.createOscillator(); o.frequency.value = isBar ? 1320 : 880;
        const gg = graph.ctx.createGain();
        gg.gain.setValueAtTime(0.35, t); gg.gain.setTargetAtTime(0.0001, t, 0.02);
        o.connect(gg); gg.connect(graph.master.vol);
        o.start(t); o.stop(t + 0.09);
      }
    }
  };

  // ======================================================
  // TRANSPORT
  // ======================================================
  const T = G.transport = {
    playing: false,
    mode: 'pat',            // 'pat' | 'song'
    metronome: false,
    queuedPattern: null,
    _timer: null,
    _nextTick: 0,
    _tickTime: 0,           // ctx time of _nextTick
    _segs: [],              // [{time, tick, spt}] for display
  };

  const LOOKAHEAD = 0.15, INTERVAL = 40;

  T.spt = () => 60 / (G.proj.bpm * G.PPQ);

  const rtGraph = () => ({
    ctx: A.ctx,
    stripFor: (id) => { const c = G.chanById(id); return c ? A.ensureStrip(c) : null; },
    master: A.master,
    metronome: true,
    track: true,
    autoParams: (T._autoParams = T._autoParams || new Set()),
  });

  T.startFrom = null;   // set by playlist seek — where SONG playback begins

  T.start = async (fromTick) => {
    await A.init();
    if (A.ctx.state === 'suspended') { try { await A.ctx.resume(); } catch (e) {} }
    if (T.playing) T.stop(true);
    const proj = G.proj;
    T.playing = true;
    T._nextTick = fromTick !== undefined ? fromTick
      : (T.mode === 'song'
        ? (T.startFrom != null ? T.startFrom : (proj.loop.on ? proj.loop.a : 0))
        : 0);
    T._tickTime = A.ctx.currentTime + 0.08;
    T._segs = [{ time: T._tickTime, tick: T._nextTick, spt: T.spt() }];
    T._timer = setInterval(schedulerTick, INTERVAL);
    schedulerTick();
    G.emit('transport');
  };

  T.stop = (soft) => {
    if (T._timer) { clearInterval(T._timer); T._timer = null; }
    T.playing = false;
    T.queuedPattern = null;
    A.stopAllVoices();
    if (A.ctx) {
      A.strips.forEach(s => s.chain.stopSched());
      if (A.master) A.master.chain.stopSched();
      // cancel automation ramps and restore user values
      if (T._autoParams) {
        T._autoParams.forEach(p => { try { p.cancelScheduledValues(0); } catch (e) {} });
        T._autoParams.clear();
      }
      G.proj.channels.forEach(c => A.applyChanParams(c));
      if (A.master) A.master.vol.gain.value = G.proj.masterVol;
    }
    if (!soft) G.emit('transport');
  };

  T.toggle = () => { T.playing ? T.stop() : T.start(); };

  T.posTicks = () => {
    if (!T.playing || !A.ctx) return 0;
    const now = A.ctx.currentTime;
    let seg = T._segs[0];
    for (const s of T._segs) { if (s.time <= now) seg = s; else break; }
    if (!seg) return 0;
    return Math.max(0, seg.tick + (now - seg.time) / seg.spt);
  };

  const schedulerTick = () => {
    if (!T.playing || !A.ctx) return;
    const proj = G.proj;
    const now = A.ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    let spt = T.spt();
    let guard = 0;

    while (T._tickTime < horizon && guard++ < 64) {
      // window in ticks — schedule in slices up to next loop boundary
      let end;
      if (T.mode === 'pat') {
        const pat = G.patById(G.sel.patternId) || proj.patterns[0];
        end = G.patTicks(pat);
      } else {
        end = proj.loop.on ? proj.loop.b : G.songTicks();
        if (T._nextTick >= end) end = T._nextTick + G.BAR; // play past loop if started there
      }
      const windowTicks = Math.max(1, Math.round((horizon - T._tickTime) / spt));
      const sliceEnd = Math.min(T._nextTick + windowTicks, end);

      if (sliceEnd > T._nextTick) {
        scheduleRange(rtGraph(), proj, T.mode, G.sel.patternId, T._nextTick, sliceEnd, T._tickTime, spt, { songAuto: T.mode === 'song' });
        T._tickTime += (sliceEnd - T._nextTick) * spt;
        T._nextTick = sliceEnd;
      }

      // loop wrap
      if (T._nextTick >= end) {
        if (T.mode === 'pat') {
          if (T.queuedPattern && G.patById(T.queuedPattern)) {
            const qp = T.queuedPattern;
            const switchInMs = Math.max(0, (T._tickTime - now) * 1000);
            setTimeout(() => { G.sel.patternId = qp; T.queuedPattern = null; G.emit('patterns'); G.emit('notes'); }, switchInMs);
            G.sel.patternId = qp;  // scheduler uses it immediately
            T.queuedPattern = null;
          }
          T._nextTick = 0;
        } else {
          if (proj.loop.on) T._nextTick = proj.loop.a;
          else { T.stopAtTime = T._tickTime; T._nextTick = 0; setTimeout(() => T.stop(), Math.max(0, (T._tickTime - now) * 1000) + 200); break; }
        }
        T._segs.push({ time: T._tickTime, tick: T._nextTick, spt });
        if (T._segs.length > 24) T._segs.splice(0, T._segs.length - 24);
      }
    }
  };

  T.setBpm = (bpm) => {
    bpm = G.clamp(Math.round(bpm * 10) / 10, 40, 260);
    if (bpm === G.proj.bpm) return;
    G.proj.bpm = bpm;
    if (T.playing && A.ctx) {
      // rebase timeline so future scheduling uses the new tempo
      T._segs.push({ time: T._tickTime, tick: T._nextTick, spt: T.spt() });
    }
    A.refreshTempo();
    G.emit('bpm');
  };

  T.queuePattern = (id) => {
    if (!T.playing || T.mode !== 'pat') {
      G.sel.patternId = id; G.emit('patterns'); G.emit('notes');
      return;
    }
    if (id === G.sel.patternId) return;
    T.queuedPattern = id;
    G.emit('patterns');
  };

  // ======================================================
  // OFFLINE EXPORT
  // ======================================================
  A.exportWav = async (scope) => {
    await A.init();
    const proj = G.proj;
    const spt = 60 / (proj.bpm * G.PPQ);
    let ticks;
    if (scope === 'pattern') {
      const pat = G.curPattern(); ticks = G.patTicks(pat);
    } else {
      ticks = G.songTicks();
    }
    const tailSec = 3;
    const sr = 44100;
    const lenSec = ticks * spt + tailSec;
    const octx = new OfflineAudioContext(2, Math.ceil(lenSec * sr), sr);

    const master = buildMaster(octx, proj);
    master.out.connect(octx.destination);
    const buses = buildBuses(octx, proj, master.input);
    const strips = new Map();
    proj.channels.forEach(ch => strips.set(ch.id, buildStrip(octx, ch, proj, master, buses, false)));

    const graph = {
      ctx: octx,
      stripFor: (id) => strips.get(id),
      master, metronome: false, track: false,
    };
    const t0 = 0.05;
    scheduleRange(graph, proj, scope === 'pattern' ? 'pat' : 'song',
      scope === 'pattern' ? G.curPattern().id : null,
      0, ticks, t0, spt, { songAuto: scope !== 'pattern' });

    const buf = await octx.startRendering();
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    // normalize to -0.3 dBFS if it clips
    let peak = 0;
    for (let i = 0; i < L.length; i += 7) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    if (peak > 0.97) {
      const k = 0.97 / peak;
      for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
    }
    return G.encodeWav([L, R], sr);
  };

})(window.G);
