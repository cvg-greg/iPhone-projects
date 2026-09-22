import math, random, struct, wave, base64, io, os

SR = 22050

def hp(sig, a=0.65):
    """one-pole high-pass -- only a trace of this survives, for the contact tick"""
    out, prev_in, prev_out = [], 0.0, 0.0
    for x in sig:
        y = a * (prev_out + x - prev_in)
        out.append(y); prev_in = x; prev_out = y
    return out

def lp(sig, a=0.30):
    """one-pole low-pass -- takes the brightness off the strike"""
    out, prev = [], 0.0
    for x in sig:
        prev = prev + a * (x - prev)
        out.append(prev)
    return out

def synth(seed, kind='click'):
    """A small dull metal flap, not a wooden block.

    Two things separate the two materials to the ear. Wood rings on modes
    close to whole-number ratios; metal rings on inharmonic ones, and that
    mismatch is most of what says 'metal'. And wood's strike is bright and
    instantly gone, where a damped metal flap keeps a low body for a few tens
    of milliseconds. So the modes below sit on bar-like ratios, the
    fundamental is dropped about an octave and a third, and the contact burst
    is low-passed with only a trace of the bright tick left on top.
    """
    rng = random.Random(seed)
    dur   = 0.062 if kind == 'click' else 0.125
    n     = int(dur * SR)
    buf   = [0.0] * n

    # the flap swinging through air just before it lands
    air = int(0.005 * SR)
    for i in range(air):
        buf[i] += rng.uniform(-1, 1) * 0.035 * (i / air) ** 2

    t0 = air
    tail = n - t0
    raw  = [rng.uniform(-1, 1) for _ in range(tail)]
    body = lp(raw, 0.30)                      # the dull part of the contact
    tick = hp(raw, 0.65)                      # a sliver of bright edge
    tau  = rng.uniform(0.0045, 0.0075) if kind == 'click' else rng.uniform(0.008, 0.013)
    for i in range(tail):
        t = i / SR
        buf[t0 + i] += body[i] * math.exp(-t / tau) * 1.00
        buf[t0 + i] += tick[i] * math.exp(-t / 0.0012) * 0.20

    # inharmonic modes, the way a struck metal plate rings
    if kind == 'click':
        f0     = rng.uniform(300, 400)
        ratios = [1.0, 1.77, 2.81, 4.19]
        decays = [rng.uniform(0.017, 0.023), rng.uniform(0.012, 0.016),
                  rng.uniform(0.008, 0.011), rng.uniform(0.005, 0.007)]
        amps   = [0.46, 0.26, 0.15, 0.08]
    else:
        f0     = rng.uniform(190, 250)
        ratios = [1.0, 1.74, 2.88, 4.27]
        decays = [rng.uniform(0.044, 0.056), rng.uniform(0.030, 0.038),
                  rng.uniform(0.018, 0.024), rng.uniform(0.011, 0.015)]
        amps   = [0.52, 0.28, 0.14, 0.07]

    for ratio, decay, amp in zip(ratios, decays, amps):
        f  = f0 * ratio * rng.uniform(0.985, 1.015)
        f2 = f * rng.uniform(1.004, 1.012)    # a near neighbour, for the faint beating metal has
        ph = rng.uniform(0, 2 * math.pi)
        for i in range(t0, n):
            t = (i - t0) / SR
            e = math.exp(-t / decay)
            buf[i] += (math.sin(2 * math.pi * f * t + ph) * 0.75 +
                       math.sin(2 * math.pi * f2 * t + ph * 0.5) * 0.25) * e * amp

    # fade the last 3ms so the buffer never ends on a step
    fade = int(0.003 * SR)
    for i in range(fade):
        buf[n - 1 - i] *= i / fade

    peak = max(abs(v) for v in buf) or 1.0
    return [v / peak * 0.95 for v in buf]

def wav_b64(samples):
    raw = b''.join(struct.pack('<h', max(-32768, min(32767, int(s * 32767)))) for s in samples)
    bio = io.BytesIO()
    w = wave.open(bio, 'wb')
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(raw); w.close()
    return base64.b64encode(bio.getvalue()).decode('ascii')

clicks = [wav_b64(synth(1000 + i, 'click')) for i in range(6)]
thunk  = wav_b64(synth(77, 'thunk'))

lines = []
lines.append('/* Six flap strikes and one settle, synthesised as 22.05 kHz mono PCM and')
lines.append('   baked in as WAV so the board ships with its own sound and needs nothing')
lines.append('   from the network. Built by tools/make-clicks.py. */')
lines.append('const CLICK_WAV = [')
for c in clicks:
    lines.append("  '" + c + "',")
lines.append('];')
lines.append("const THUNK_WAV = '" + thunk + "';")
js = '\n'.join(lines)
open('clicks.js.frag', 'w').write(js)

total = sum(len(c) for c in clicks) + len(thunk)
print('6 clicks + 1 settle')
print('sample rate %d Hz, click %d ms, settle %d ms' % (SR, 62, 125))
print('embedded base64 total: %.1f KB' % (total / 1024.0))
