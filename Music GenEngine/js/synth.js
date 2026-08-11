/* ============================================================
   GENENGINE — synth.js
   All sound generation: synth engines (supersaw / acid / FM /
   pluck / sub / noise-riser), synthesized drum kit, sampler.
   Pure functions of (ctx, dest) so they run in realtime AND
   offline (WAV export) contexts.

   G.synth.play(ctx, dest, chan, ev) -> voice handle
     ev = { pitch, vel, t, dur (sec|null), slideFrom (midi|null) }
   ============================================================ */
'use strict';
(function (G) {

  const S = G.synth = {};

  // ---------- shared noise buffer ----------
  const noiseCache = new WeakMap();
  S.noiseBuf = (ctx) => {
    let b = noiseCache.get(ctx);
    if (!b) {
      b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseCache.set(ctx, b);
    }
    return b;
  };

  const noiseSrc = (ctx) => {
    const src = ctx.createBufferSource();
    src.buffer = S.noiseBuf(ctx); src.loop = true;
    return src;
  };

  const softClip = (ctx, amt) => {
    const ws = ctx.createWaveShaper();
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * amt); }
    ws.curve = c;
    return ws;
  };

  // ---------- voice bookkeeping ----------
  const mkVoice = (ctx, nodes, sources, ampGain, relTime) => {
    const v = {
      nodes, sources, amp: ampGain, released: false,
      detunables: [],   // oscillators whose .detune should follow channel pitch
      release(t) {
        if (v.released) return; v.released = true;
        t = t || ctx.currentTime;
        try {
          v.amp.gain.setTargetAtTime(0, t, Math.max(0.004, relTime / 3));
        } catch (e) {}
        v.stopAt(t + Math.max(0.02, relTime * 4));
      },
      stopAt(t) {
        sources.forEach(s => { try { s.stop(t); } catch (e) {} });
      },
      kill() {
        const t = ctx.currentTime;
        try { v.amp.gain.cancelScheduledValues(t); v.amp.gain.setTargetAtTime(0, t, 0.008); } catch (e) {}
        v.stopAt(t + 0.05);
      },
    };
    return v;
  };

  // amp envelope for scheduled notes
  const ampEnv = (g, t0, peak, a, d, sus, tEnd, rel) => {
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + Math.max(0.001, a));
    g.setTargetAtTime(peak * sus, t0 + Math.max(0.001, a), Math.max(0.008, d / 3));
    if (tEnd != null) {
      g.setTargetAtTime(0, tEnd, Math.max(0.005, rel / 3));
    }
  };

  // ========================================================
  // SYNTH ENGINES
  // ========================================================
  S.play = (ctx, dest, chan, ev) => {
    if (chan.kind === 'drum') return S.playDrum(ctx, dest, chan, ev);
    if (chan.kind === 'sampler') return S.playSample(ctx, dest, chan, ev);
    return S.playSynth(ctx, dest, chan, ev);
  };

  S.playSynth = (ctx, dest, chan, ev) => {
    const p = chan.synth;
    const t0 = ev.t, vel = ev.vel !== undefined ? ev.vel : 0.8;
    const pitch = ev.pitch + (chan.pitch || 0) + (ev.pitchOfs || 0);
    const freq = G.midiToFreq(pitch);
    const tEnd = ev.dur != null ? t0 + ev.dur : null;

    const amp = ctx.createGain();
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
    flt.Q.value = p.res;
    const out = ctx.createGain();
    out.gain.value = (p.gain !== undefined ? p.gain : 0.8) * (0.35 + 0.65 * vel);
    flt.connect(amp); amp.connect(out); out.connect(dest);

    // filter envelope
    const baseCut = p.cutoff * (0.5 + vel * 0.7);
    const fPeak = Math.min(19000, baseCut + p.fenv * (0.4 + vel * 0.8));
    flt.frequency.setValueAtTime(Math.max(30, baseCut * 0.4), t0);
    flt.frequency.linearRampToValueAtTime(fPeak, t0 + Math.max(0.001, p.fattack));
    flt.frequency.setTargetAtTime(Math.max(50, baseCut * 0.6), t0 + Math.max(0.001, p.fattack), Math.max(0.01, p.fdecay / 3));

    const sources = [], detunables = [];
    const engine = p.engine || 'super';

    const startPitchRamp = (osc, fr) => {
      // glide / slide support + per-note bend
      const glide = ev.slideFrom != null ? Math.max(0.02, p.glide || 0.06) : (p.glide || 0);
      if (ev.slideFrom != null && glide > 0) {
        osc.frequency.setValueAtTime(G.midiToFreq(ev.slideFrom + (chan.pitch || 0)) * (fr / freq), t0);
        osc.frequency.exponentialRampToValueAtTime(fr, t0 + glide);
      } else if (glide > 0 && S._lastPitch[chan.id] != null && S._lastPitch[chan.id] !== pitch) {
        osc.frequency.setValueAtTime(G.midiToFreq(S._lastPitch[chan.id]) * (fr / freq), t0);
        osc.frequency.exponentialRampToValueAtTime(fr, t0 + glide);
      } else {
        osc.frequency.setValueAtTime(fr, t0);
      }
      if (p.bend) {
        // pitch bender: sweep from -bend semitones into the note pitch
        const bt = p.bendTime && p.bendTime > 0 ? p.bendTime : (ev.dur || 0.5);
        osc.frequency.setValueAtTime(fr * Math.pow(2, -p.bend / 12), t0);
        osc.frequency.exponentialRampToValueAtTime(fr, t0 + bt);
      }
    };

    if (engine === 'fm') {
      const car = ctx.createOscillator(); car.type = 'sine';
      const mod = ctx.createOscillator(); mod.type = 'sine';
      const mg = ctx.createGain();
      mod.frequency.setValueAtTime(freq * (p.fmRatio || 2), t0);
      mg.gain.setValueAtTime(p.fmAmt * (0.4 + vel), t0);
      mg.gain.setTargetAtTime(p.fmAmt * 0.05, t0, Math.max(0.01, p.fmDecay / 3));
      mod.connect(mg); mg.connect(car.frequency);
      startPitchRamp(car, freq);
      car.connect(flt);
      car.start(t0); mod.start(t0);
      sources.push(car, mod); detunables.push(car);
    } else {
      const unison = engine === 'super' ? Math.max(1, Math.round(p.unison || 1)) : 1;
      for (let i = 0; i < unison; i++) {
        const osc = ctx.createOscillator();
        osc.type = p.wave === 'noise' ? 'sawtooth' : p.wave;
        const det = unison > 1 ? (i / (unison - 1) - 0.5) * 2 * p.detune : 0;
        osc.detune.value = det;
        osc._baseDetune = det;
        startPitchRamp(osc, freq);
        let node = osc;
        if (unison > 1 && p.spread > 0 && ctx.createStereoPanner) {
          const pan = ctx.createStereoPanner();
          pan.pan.value = (i / (unison - 1) - 0.5) * 2 * p.spread;
          osc.connect(pan); node = pan;
        }
        const og = ctx.createGain(); og.gain.value = 1 / Math.sqrt(unison);
        node.connect(og); og.connect(flt);
        osc.start(t0);
        sources.push(osc); detunables.push(osc);
      }
      if (p.sub > 0) {
        const sub = ctx.createOscillator(); sub.type = 'sine';
        sub.frequency.setValueAtTime(freq / 2, t0);
        const sg = ctx.createGain(); sg.gain.value = p.sub;
        sub.connect(sg); sg.connect(flt);
        sub.start(t0); sources.push(sub); detunables.push(sub);
      }
      if (p.noise > 0) {
        const ns = noiseSrc(ctx);
        const ng = ctx.createGain(); ng.gain.value = p.noise * 0.5;
        ns.connect(ng); ng.connect(flt);
        ns.start(t0); sources.push(ns);
      }
    }

    ampEnv(amp.gain, t0, 1, p.attack, p.decay, p.sustain, tEnd, p.release);
    const v = mkVoice(ctx, [amp, flt, out], sources, amp, p.release);
    v.detunables = detunables;
    if (tEnd != null) v.stopAt(tEnd + Math.max(0.05, p.release * 4));
    S._lastPitch[chan.id] = pitch;
    return v;
  };
  S._lastPitch = {};

  // ========================================================
  // DRUMS — synthesized 808/909-flavoured space kit
  // ========================================================
  S.DRUM_TYPES = [
    ['kick', 'Kick 909'], ['kick808', 'Kick 808'], ['snare', 'Snare'], ['clap', 'Clap'],
    ['hat', 'Hat Closed'], ['openhat', 'Hat Open'], ['ride', 'Ride'], ['crash', 'Crash'],
    ['tom', 'Tom'], ['rim', 'Rim'], ['zap', 'Zap'], ['noiseFx', 'Noise Hit'],
  ];

  S.playDrum = (ctx, dest, chan, ev) => {
    const type = chan.drum.type;
    const t0 = ev.t, vel = ev.vel !== undefined ? ev.vel : 0.9;
    const tune = Math.pow(2, ((ev.pitch - 60) + (chan.pitch || 0)) / 12);  // C4 = neutral
    const out = ctx.createGain(); out.gain.value = vel;
    out.connect(dest);
    const sources = [];
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };

    const env = (param, peak, dec, t) => {
      param.setValueAtTime(peak, t || t0);
      param.setTargetAtTime(0.0001, t || t0, dec / 4);
    };

    switch (type) {
      case 'kick': case 'kick808': {
        const is808 = type === 'kick808';
        const osc = ctx.createOscillator(); osc.type = 'sine';
        const f0 = (is808 ? 55 : 52) * tune;
        osc.frequency.setValueAtTime(f0 * (is808 ? 3.2 : 4.2), t0);
        osc.frequency.exponentialRampToValueAtTime(f0, t0 + (is808 ? 0.09 : 0.055));
        const og = g(1.2);
        const clip = softClip(ctx, is808 ? 1.6 : 2.6);
        env(og.gain, 1.25, is808 ? 0.9 : 0.32);
        osc.connect(og); og.connect(clip); clip.connect(out);
        osc.start(t0); osc.stop(t0 + (is808 ? 1.4 : 0.6)); sources.push(osc);
        // click
        const ns = noiseSrc(ctx); const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1200;
        const ng = g(is808 ? 0.15 : 0.5); env(ng.gain, is808 ? 0.15 : 0.5, 0.012);
        ns.connect(nf); nf.connect(ng); ng.connect(out);
        ns.start(t0); ns.stop(t0 + 0.05); sources.push(ns);
        break;
      }
      case 'snare': {
        const osc = ctx.createOscillator(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(340 * tune, t0);
        osc.frequency.exponentialRampToValueAtTime(180 * tune, t0 + 0.06);
        const og = g(0.6); env(og.gain, 0.6, 0.09);
        osc.connect(og); og.connect(out); osc.start(t0); osc.stop(t0 + 0.3); sources.push(osc);
        const ns = noiseSrc(ctx); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1900 * tune; nf.Q.value = 0.8;
        const ng = g(0.8); env(ng.gain, 0.8, 0.17);
        ns.connect(nf); nf.connect(ng); ng.connect(out); ns.start(t0); ns.stop(t0 + 0.4); sources.push(ns);
        break;
      }
      case 'clap': {
        const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1150 * tune; nf.Q.value = 1.4;
        nf.connect(out);
        for (let i = 0; i < 4; i++) {
          const ns = noiseSrc(ctx); const ng = g(0);
          const tt = t0 + i * 0.011;
          ng.gain.setValueAtTime(i === 3 ? 0.9 : 0.6, tt);
          ng.gain.setTargetAtTime(0.0001, tt, i === 3 ? 0.07 : 0.008);
          ns.connect(ng); ng.connect(nf); ns.start(tt); ns.stop(tt + 0.45); sources.push(ns);
        }
        break;
      }
      case 'hat': case 'openhat': case 'ride': {
        const open = type !== 'hat';
        const dec = type === 'ride' ? 0.9 : open ? 0.38 : 0.045;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = (type === 'ride' ? 5200 : 7400) * tune;
        const hg = g(0.55); env(hg.gain, 0.55, dec);
        hp.connect(hg); hg.connect(out);
        [2, 3, 4.16, 5.43, 6.79, 8.21].forEach(r => {
          const o = ctx.createOscillator(); o.type = 'square';
          o.frequency.value = 40 * r * 8 * tune;
          const og2 = g(0.16); o.connect(og2); og2.connect(hp);
          o.start(t0); o.stop(t0 + dec * 4 + 0.05); sources.push(o);
        });
        if (type === 'ride') {
          const ns = noiseSrc(ctx); const ng = g(0.12); env(ng.gain, 0.12, 0.8);
          ns.connect(ng); ng.connect(hp); ns.start(t0); ns.stop(t0 + 2); sources.push(ns);
        }
        break;
      }
      case 'crash': {
        const ns = noiseSrc(ctx);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200 * tune;
        const ng = g(0.8); env(ng.gain, 0.8, 1.4);
        ns.connect(hp); hp.connect(ng); ng.connect(out); ns.start(t0); ns.stop(t0 + 3); sources.push(ns);
        break;
      }
      case 'tom': {
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(260 * tune, t0);
        osc.frequency.exponentialRampToValueAtTime(95 * tune, t0 + 0.16);
        const og = g(1); env(og.gain, 1, 0.28);
        osc.connect(og); og.connect(out); osc.start(t0); osc.stop(t0 + 0.6); sources.push(osc);
        break;
      }
      case 'rim': {
        const osc = ctx.createOscillator(); osc.type = 'square';
        osc.frequency.value = 1750 * tune;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3900; bp.Q.value = 2;
        const og = g(0.7); env(og.gain, 0.7, 0.012);
        osc.connect(bp); bp.connect(og); og.connect(out); osc.start(t0); osc.stop(t0 + 0.08); sources.push(osc);
        break;
      }
      case 'zap': {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2600 * tune, t0);
        osc.frequency.exponentialRampToValueAtTime(60 * tune, t0 + 0.14);
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 5200; flt.Q.value = 8;
        const og = g(0.8); env(og.gain, 0.8, 0.13);
        osc.connect(flt); flt.connect(og); og.connect(out); osc.start(t0); osc.stop(t0 + 0.4); sources.push(osc);
        break;
      }
      case 'noiseFx': default: {
        const ns = noiseSrc(ctx);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 * tune; bp.Q.value = 1.2;
        const ng = g(0.7); env(ng.gain, 0.7, 0.2);
        ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t0); ns.stop(t0 + 0.6); sources.push(ns);
        break;
      }
    }

    const v = mkVoice(ctx, [out], sources, out, 0.05);
    return v;
  };

  // ========================================================
  // SAMPLER
  // ========================================================
  S.playSample = (ctx, dest, chan, ev) => {
    const smp = chan.sample;
    if (!smp || !smp.buffer) return null;
    const sp = chan.samp || {};
    const t0 = ev.t, vel = ev.vel !== undefined ? ev.vel : 0.8;
    const src = ctx.createBufferSource();
    src.buffer = smp.buffer;
    const root = sp.root || 60;
    src.playbackRate.value = Math.pow(2, (ev.pitch - root + (chan.pitch || 0)) / 12);
    const amp = ctx.createGain();
    amp.gain.value = 0;
    const attack = sp.attack || 0.001, release = sp.release || 0.05;
    const gain = (sp.gain !== undefined ? sp.gain : 1) * (0.4 + 0.6 * vel);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + attack);
    src.connect(amp); amp.connect(dest);
    const dur = smp.buffer.duration;
    const start = (sp.start || 0) * dur;
    const end = (sp.end !== undefined ? sp.end : 1) * dur;
    if (sp.loop) {
      src.loop = true; src.loopStart = start; src.loopEnd = end;
      src.start(t0, start);
    } else {
      src.start(t0, start, Math.max(0.01, end - start));
    }
    let tEnd = ev.dur != null ? t0 + ev.dur : (sp.loop ? null : t0 + (end - start) / src.playbackRate.value);
    if (tEnd != null) {
      amp.gain.setTargetAtTime(0, tEnd, Math.max(0.005, release / 3));
    }
    const v = mkVoice(ctx, [amp], [src], amp, release);
    if (tEnd != null) v.stopAt(tEnd + release * 4 + 0.05);
    return v;
  };

})(window.G);
