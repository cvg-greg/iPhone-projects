/* ============================================================
   GENENGINE — fx.js
   Effect definitions & builders. Every effect is a pure Web Audio
   node graph so it works in both realtime and offline (export) mode.

   Instance API: { in, out, set(params), onBar?(barTime,bpm,params),
                   stopSched?(), dispose() }
   ============================================================ */
'use strict';
(function (G) {

  const FX = G.fx = { defs: {} };

  const def = (type, meta) => { FX.defs[type] = meta; };
  const P = (label, min, max, def_, opts) => Object.assign({ label, min, max, def: def_ }, opts || {});

  const mkLFO = (ctx, freq, amp) => {
    const osc = ctx.createOscillator(); osc.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = amp;
    osc.connect(g); osc.start();
    return { osc, g };
  };

  const mkMix = (ctx) => {
    // returns {in, out, dry, wet, setMix}
    const input = ctx.createGain(), output = ctx.createGain();
    const dry = ctx.createGain(), wet = ctx.createGain();
    input.connect(dry); dry.connect(output); wet.connect(output);
    return {
      in: input, out: output, dry, wet,
      setMix: (m) => { dry.gain.value = Math.cos(m * Math.PI / 2); wet.gain.value = Math.sin(m * Math.PI / 2); },
    };
  };

  // ================= FILTER =================
  def('filter', {
    name: 'Filter', icon: '◢',
    params: {
      type: P('Type', 0, 0, 'lowpass', { type: 'select', options: [['lowpass', 'Low Pass'], ['highpass', 'High Pass'], ['bandpass', 'Band Pass'], ['notch', 'Notch']] }),
      cutoff: P('Cutoff', 40, 18000, 2200, { unit: 'Hz', curve: 'exp' }),
      res: P('Reso', 0.1, 24, 1.5),
      drive: P('Drive', 1, 12, 1),
    },
    build(ctx) {
      const input = ctx.createGain();
      const pre = ctx.createGain();
      const bq = ctx.createBiquadFilter();
      const out = ctx.createGain();
      input.connect(pre); pre.connect(bq); bq.connect(out);
      return {
        in: input, out,
        set(p) {
          bq.type = p.type; bq.frequency.value = p.cutoff; bq.Q.value = p.res;
          pre.gain.value = p.drive; out.gain.value = 1 / Math.pow(p.drive, 0.6);
        },
        auto: { cutoff: (v) => bq.frequency, res: () => bq.Q },
        dispose() {},
      };
    },
  });

  // ================= EQ3 =================
  def('eq3', {
    name: 'EQ Three', icon: '≡',
    params: {
      low: P('Low', -18, 18, 0, { unit: 'dB' }),
      mid: P('Mid', -18, 18, 0, { unit: 'dB' }),
      midf: P('Mid Hz', 200, 8000, 1200, { unit: 'Hz', curve: 'exp' }),
      high: P('High', -18, 18, 0, { unit: 'dB' }),
    },
    build(ctx) {
      const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 250;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.Q.value = 0.9;
      const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 6000;
      lo.connect(mid); mid.connect(hi);
      return {
        in: lo, out: hi,
        set(p) { lo.gain.value = p.low; mid.gain.value = p.mid; mid.frequency.value = p.midf; hi.gain.value = p.high; },
        dispose() {},
      };
    },
  });

  // ================= DISTORTION =================
  const distCurve = (kind, amt, n) => {
    n = n || 2048;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * 2 - 1;
      let y;
      switch (kind) {
        case 'tube': y = Math.tanh(x * amt); break;
        case 'hard': y = G.clamp(x * amt, -1, 1); break;
        case 'fold': { let v = x * amt; y = Math.sin(v * Math.PI / 2); break; }
        case 'fuzz': y = Math.sign(x) * Math.pow(Math.abs(Math.tanh(x * amt)), 0.7); break;
        default: y = Math.tanh(x * amt);
      }
      c[i] = y * 0.9;
    }
    return c;
  };

  def('dist', {
    name: 'Distortion', icon: '🔥',
    params: {
      kind: P('Mode', 0, 0, 'tube', { type: 'select', options: [['tube', 'Tube'], ['hard', 'Hard Clip'], ['fold', 'Folder'], ['fuzz', 'Fuzz']] }),
      drive: P('Drive', 1, 40, 6, { curve: 'exp' }),
      tone: P('Tone', 500, 18000, 8000, { unit: 'Hz', curve: 'exp' }),
      mix: P('Mix', 0, 1, 1),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const ws = ctx.createWaveShaper(); ws.oversample = '4x';
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
      const lvl = ctx.createGain();
      mx.in.connect(ws); ws.connect(tone); tone.connect(lvl); lvl.connect(mx.wet);
      return {
        in: mx.in, out: mx.out,
        set(p) {
          ws.curve = distCurve(p.kind, p.drive);
          tone.frequency.value = p.tone;
          lvl.gain.value = 1 / Math.pow(p.drive, 0.35);
          mx.setMix(p.mix);
        },
        dispose() {},
      };
    },
  });

  // ================= CRUSHER =================
  def('crush', {
    name: 'Crusher', icon: '▦',
    params: {
      bits: P('Bits', 1, 16, 6),
      grit: P('Grit', 500, 18000, 6000, { unit: 'Hz', curve: 'exp' }),
      crunch: P('Crunch', 1, 10, 2),
      mix: P('Mix', 0, 1, 1),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const pre = ctx.createGain();
      const ws = ctx.createWaveShaper();
      const grit = ctx.createBiquadFilter(); grit.type = 'lowpass';
      mx.in.connect(pre); pre.connect(ws); ws.connect(grit); grit.connect(mx.wet);
      return {
        in: mx.in, out: mx.out,
        set(p) {
          const steps = Math.pow(2, p.bits);
          const n = 4096, c = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const x = i / (n - 1) * 2 - 1;
            c[i] = Math.round(Math.tanh(x * p.crunch) * steps / 2) / (steps / 2);
          }
          ws.curve = c;
          pre.gain.value = 1;
          grit.frequency.value = p.grit;
          mx.setMix(p.mix);
        },
        dispose() {},
      };
    },
  });

  // ================= CHORUS =================
  def('chorus', {
    name: 'Chorus', icon: '〰',
    params: {
      rate: P('Rate', 0.05, 8, 0.6, { unit: 'Hz', curve: 'exp' }),
      depth: P('Depth', 0.0005, 0.008, 0.003, { fmt: v => (v * 1000).toFixed(1) + 'ms' }),
      width: P('Width', 0, 1, 0.8),
      mix: P('Mix', 0, 1, 0.5),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const dl = ctx.createDelay(0.1), dr = ctx.createDelay(0.1);
      dl.delayTime.value = 0.018; dr.delayTime.value = 0.024;
      const pl = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      const pr = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      const lfo1 = mkLFO(ctx, 0.6, 0.003), lfo2 = mkLFO(ctx, 0.73, 0.003);
      lfo1.g.connect(dl.delayTime); lfo2.g.connect(dr.delayTime);
      mx.in.connect(dl); mx.in.connect(dr);
      dl.connect(pl); dr.connect(pr); pl.connect(mx.wet); pr.connect(mx.wet);
      return {
        in: mx.in, out: mx.out,
        set(p) {
          lfo1.osc.frequency.value = p.rate; lfo2.osc.frequency.value = p.rate * 1.21;
          lfo1.g.gain.value = p.depth; lfo2.g.gain.value = p.depth;
          if (pl.pan) { pl.pan.value = -p.width; pr.pan.value = p.width; }
          mx.setMix(p.mix);
        },
        dispose() { lfo1.osc.stop(); lfo2.osc.stop(); },
      };
    },
  });

  // ================= FLANGER =================
  def('flanger', {
    name: 'Flanger', icon: '🌀',
    params: {
      rate: P('Rate', 0.05, 5, 0.25, { unit: 'Hz', curve: 'exp' }),
      depth: P('Depth', 0.0002, 0.004, 0.002, { fmt: v => (v * 1000).toFixed(2) + 'ms' }),
      feedback: P('Feedb', 0, 0.93, 0.6),
      mix: P('Mix', 0, 1, 0.5),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const delay = ctx.createDelay(0.05); delay.delayTime.value = 0.0035;
      const fb = ctx.createGain();
      const lfo = mkLFO(ctx, 0.25, 0.002);
      lfo.g.connect(delay.delayTime);
      mx.in.connect(delay); delay.connect(mx.wet);
      delay.connect(fb); fb.connect(delay);
      return {
        in: mx.in, out: mx.out,
        set(p) {
          lfo.osc.frequency.value = p.rate;
          lfo.g.gain.value = p.depth;
          delay.delayTime.value = p.depth + 0.0015;
          fb.gain.value = p.feedback;
          mx.setMix(p.mix);
        },
        dispose() { lfo.osc.stop(); },
      };
    },
  });

  // ================= PHASER =================
  def('phaser', {
    name: 'Phaser', icon: '◐',
    params: {
      rate: P('Rate', 0.05, 8, 0.4, { unit: 'Hz', curve: 'exp' }),
      depth: P('Depth', 100, 2400, 900, { unit: 'Hz' }),
      base: P('Center', 200, 4000, 900, { unit: 'Hz', curve: 'exp' }),
      feedback: P('Feedb', 0, 0.9, 0.45),
      mix: P('Mix', 0, 1, 0.5),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const stages = [];
      let node = mx.in;
      const fbIn = ctx.createGain();
      for (let i = 0; i < 6; i++) {
        const ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.Q.value = 0.6;
        node.connect(ap); if (i === 0) fbIn.connect(ap); node = ap; stages.push(ap);
      }
      const fb = ctx.createGain();
      node.connect(mx.wet); node.connect(fb); fb.connect(fbIn);
      const lfo = mkLFO(ctx, 0.4, 400);
      stages.forEach(ap => lfo.g.connect(ap.frequency));
      return {
        in: mx.in, out: mx.out,
        set(p) {
          lfo.osc.frequency.value = p.rate;
          lfo.g.gain.value = p.depth / 2;
          stages.forEach((ap, i) => ap.frequency.value = p.base * (1 + i * 0.6));
          fb.gain.value = p.feedback;
          mx.setMix(p.mix);
        },
        dispose() { lfo.osc.stop(); },
      };
    },
  });

  // ================= DELAY =================
  const SYNC_TIMES = [['1/32', 0.125], ['1/16', 0.25], ['1/8', 0.5], ['3/16', 0.75], ['1/4', 1], ['3/8', 1.5], ['1/2', 2]];
  FX.syncToSec = (sync, bpm) => {
    const beats = (SYNC_TIMES.find(s => s[0] === sync) || ['1/4', 1])[1];
    return beats * 60 / bpm;
  };

  def('delay', {
    name: 'Echo Chamber', icon: '⧉',
    tempo: true,
    params: {
      time: P('Time', 0, 0, '3/16', { type: 'select', options: SYNC_TIMES.map(s => [s[0], s[0]]) }),
      feedback: P('Feedb', 0, 0.92, 0.45),
      tone: P('Tone', 400, 12000, 4000, { unit: 'Hz', curve: 'exp' }),
      pingpong: P('PingPong', 0, 1, 1),
      mix: P('Mix', 0, 1, 0.35),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const dL = ctx.createDelay(4), dR = ctx.createDelay(4);
      const fb = ctx.createGain(), tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
      const merger = ctx.createChannelMerger(2);
      const split = ctx.createGain();
      mx.in.connect(split);
      split.connect(dL);
      dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
      dL.connect(fb); fb.connect(tone); tone.connect(dR);
      dR.connect(dL);   // ping-pong loop
      merger.connect(mx.wet);
      return {
        in: mx.in, out: mx.out,
        set(p, bpm) {
          const t = FX.syncToSec(p.time, bpm || (G.proj ? G.proj.bpm : 138));
          dL.delayTime.value = t; dR.delayTime.value = p.pingpong > 0.5 ? t : t;
          fb.gain.value = p.feedback * 0.85;
          tone.frequency.value = p.tone;
          mx.setMix(p.mix);
        },
        dispose() {},
      };
    },
  });

  // ================= REVERB =================
  FX.makeIR = (ctx, seconds, decay, tone, shimmer) => {
    const rate = ctx.sampleRate, len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      const alpha = G.clamp(tone / 20000, 0.02, 1);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        let s = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        if (shimmer) s *= 0.7 + 0.3 * Math.sin(i / rate * Math.PI * 2 * (3 + ch));
        lp += alpha * (s - lp);
        d[i] = lp;
      }
    }
    return buf;
  };

  def('reverb', {
    name: 'Space Chamber', icon: '✧',
    params: {
      size: P('Size', 0.3, 9, 2.8, { unit: 's', curve: 'exp' }),
      decay: P('Decay', 0.8, 6, 2.2),
      tone: P('Tone', 800, 18000, 6000, { unit: 'Hz', curve: 'exp' }),
      predelay: P('PreDly', 0, 0.12, 0.02, { fmt: v => (v * 1000).toFixed(0) + 'ms' }),
      mix: P('Mix', 0, 1, 0.35),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const pd = ctx.createDelay(0.5);
      const conv = ctx.createConvolver();
      mx.in.connect(pd); pd.connect(conv); conv.connect(mx.wet);
      let irKey = '';
      return {
        in: mx.in, out: mx.out,
        set(p) {
          const key = [p.size.toFixed(2), p.decay.toFixed(2), Math.round(p.tone)].join('|');
          if (key !== irKey) { conv.buffer = FX.makeIR(ctx, p.size, p.decay, p.tone); irKey = key; }
          pd.delayTime.value = p.predelay;
          mx.setMix(p.mix);
        },
        dispose() {},
      };
    },
  });

  // ================= COMPRESSOR =================
  def('comp', {
    name: 'Compressor', icon: '◫',
    params: {
      threshold: P('Thresh', -60, 0, -18, { unit: 'dB' }),
      ratio: P('Ratio', 1, 20, 4),
      attack: P('Attack', 0.001, 0.3, 0.01, { unit: 's', curve: 'exp' }),
      release: P('Release', 0.02, 1, 0.2, { unit: 's', curve: 'exp' }),
      makeup: P('Makeup', 0, 24, 3, { unit: 'dB' }),
    },
    build(ctx) {
      const c = ctx.createDynamicsCompressor();
      const mk = ctx.createGain();
      c.connect(mk);
      return {
        in: c, out: mk,
        set(p) {
          c.threshold.value = p.threshold; c.ratio.value = p.ratio;
          c.attack.value = p.attack; c.release.value = p.release;
          c.knee.value = 6;
          mk.gain.value = Math.pow(10, p.makeup / 20);
        },
        dispose() {},
      };
    },
  });

  // ================= SIDECHAIN PUMP (DUCK) =================
  def('duck', {
    name: 'Sidechain Pump', icon: '💓',
    tempo: true, scheduled: true,
    params: {
      amount: P('Amount', 0, 1, 0.8),
      rate: P('Rate', 0, 0, '1/4', { type: 'select', options: [['1/4', '1/4 (four on floor)'], ['1/8', '1/8 (double time)'], ['1/2', '1/2 (half time)']] }),
      release: P('Recover', 0.05, 0.6, 0.24, { unit: 's' }),
      hold: P('Hold', 0, 0.15, 0.02, { unit: 's' }),
    },
    build(ctx) {
      const gn = ctx.createGain();
      return {
        in: gn, out: gn,
        set() {},
        onBar(barTime, bpm, p) {
          const beat = 60 / bpm;
          const per = p.rate === '1/8' ? beat / 2 : p.rate === '1/2' ? beat * 2 : beat;
          const n = Math.round(4 * beat / per);
          const g = gn.gain;
          for (let i = 0; i < n; i++) {
            const t = barTime + i * per;
            g.setValueAtTime(1, Math.max(t - 0.001, barTime));
            g.linearRampToValueAtTime(1 - p.amount, t + 0.004);
            g.setValueAtTime(1 - p.amount, t + 0.004 + p.hold);
            g.linearRampToValueAtTime(1, Math.min(t + 0.004 + p.hold + p.release, t + per));
          }
        },
        stopSched() { gn.gain.cancelScheduledValues(0); gn.gain.value = 1; },
        dispose() {},
      };
    },
  });

  // ================= TRANCE GATE =================
  def('gate', {
    name: 'Trance Gate', icon: '▚',
    tempo: true, scheduled: true,
    params: {
      pattern: P('Pattern', 0, 0, '1011101110111011', { type: 'gatePattern' }),
      depth: P('Depth', 0, 1, 1),
      smooth: P('Smooth', 0.001, 0.05, 0.008, { fmt: v => (v * 1000).toFixed(0) + 'ms' }),
      rate: P('Rate', 0, 0, '1/16', { type: 'select', options: [['1/8', '1/8'], ['1/16', '1/16'], ['1/32', '1/32']] }),
    },
    build(ctx) {
      const gn = ctx.createGain();
      return {
        in: gn, out: gn,
        set() {},
        onBar(barTime, bpm, p) {
          const beat = 60 / bpm;
          const stepDur = p.rate === '1/8' ? beat / 2 : p.rate === '1/32' ? beat / 8 : beat / 4;
          const steps = Math.round(4 * beat / stepDur);
          const pat = (p.pattern || '1111111111111111');
          const g = gn.gain, lo = 1 - p.depth, sm = p.smooth;
          for (let i = 0; i < steps; i++) {
            const on = pat[i % pat.length] === '1';
            const t = barTime + i * stepDur;
            g.setTargetAtTime(on ? 1 : lo, t, sm);
          }
        },
        stopSched() { gn.gain.cancelScheduledValues(0); gn.gain.value = 1; },
        dispose() {},
      };
    },
  });

  // ================= SPACE WOBBLE (pitch bend LFO) =================
  def('wobble', {
    name: 'Space Bender', icon: '🛸',
    params: {
      rate: P('Rate', 0.05, 12, 0.8, { unit: 'Hz', curve: 'exp' }),
      depth: P('Depth', 0.0002, 0.02, 0.004, { fmt: v => (v * 1000).toFixed(1) + 'ms' }),
      drift: P('Drift', 0, 1, 0.3),
      mix: P('Mix', 0, 1, 1),
    },
    build(ctx) {
      const mx = mkMix(ctx);
      const d = ctx.createDelay(0.2); d.delayTime.value = 0.02;
      const lfo = mkLFO(ctx, 0.8, 0.004);
      const drift = mkLFO(ctx, 0.11, 0.002);
      lfo.g.connect(d.delayTime); drift.g.connect(d.delayTime);
      mx.in.connect(d); d.connect(mx.wet);
      return {
        in: mx.in, out: mx.out,
        set(p) {
          lfo.osc.frequency.value = p.rate;
          lfo.g.gain.value = p.depth;
          drift.g.gain.value = p.drift * 0.004;
          d.delayTime.value = p.depth + 0.01;
          mx.setMix(p.mix);
        },
        dispose() { lfo.osc.stop(); drift.osc.stop(); },
      };
    },
  });

  // ---------- chain builder ----------
  FX.buildChain = (ctx, fxArr, bpm) => {
    const input = ctx.createGain(), output = ctx.createGain();
    const insts = [];
    let node = input;
    (fxArr || []).forEach(fx => {
      if (!fx.on) return;
      const d = FX.defs[fx.type]; if (!d) return;
      try {
        const inst = d.build(ctx);
        inst._fxId = fx.id; inst._type = fx.type;
        inst.set(fx.params, bpm);
        node.connect(inst.in); node = inst.out;
        insts.push(inst);
      } catch (e) { console.error('fx build failed', fx.type, e); }
    });
    node.connect(output);
    return {
      input, output, insts,
      onBar(t, bpm2, fxArr2) {
        insts.forEach(inst => {
          if (!inst.onBar) return;
          const fx = (fxArr2 || fxArr).find(f => f.id === inst._fxId);
          if (fx && fx.on) inst.onBar(t, bpm2, fx.params);
        });
      },
      stopSched() { insts.forEach(i => i.stopSched && i.stopSched()); },
      update(fx, bpm2) {
        const inst = insts.find(i => i._fxId === fx.id);
        if (inst) { inst.set(fx.params, bpm2); return true; }
        return false;
      },
      dispose() { insts.forEach(i => { try { i.dispose(); } catch (e) {} }); },
    };
  };

  FX.newFx = (type) => {
    const d = FX.defs[type];
    const params = {};
    Object.keys(d.params).forEach(k => params[k] = d.params[k].def);
    return { id: G.uid(), type, on: true, params };
  };

})(window.G);
