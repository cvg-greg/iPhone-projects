import math, random, struct, wave, base64, io, os

SR = 22050

def hp(sig, a=0.55):
    """one-pole high-pass, for the brightness of a hard strike"""
    out, prev_in, prev_out = [], 0.0, 0.0
    for x in sig:
        y = a * (prev_out + x - prev_in)
        out.append(y); prev_in = x; prev_out = y
    return out

def synth(seed, kind='click'):
    rng = random.Random(seed)
    dur   = 0.055 if kind == 'click' else 0.115
    n     = int(dur * SR)
    buf   = [0.0] * n

    # the card swinging through air just before it lands
    air = int(0.006 * SR)
    for i in range(air):
        buf[i] += rng.uniform(-1, 1) * 0.05 * (i / air) ** 2

    t0 = air
    # the impact itself: a broadband burst that dies almost immediately
    tau = rng.uniform(0.0018, 0.0030) if kind == 'click' else rng.uniform(0.0035, 0.0050)
    noise = [rng.uniform(-1, 1) * math.exp(-((i - t0) / SR) / tau) for i in range(t0, n)]
    for i, v in enumerate(hp(noise)):
        buf[t0 + i] += v * (0.95 if kind == 'click' else 1.0)

    # the body ringing afterwards -- damped modes, plastic-short
    if kind == 'click':
        modes = [(rng.uniform(760, 1000),  rng.uniform(0.010, 0.018), 0.30),
                 (rng.uniform(1500, 2100), rng.uniform(0.007, 0.013), 0.22),
                 (rng.uniform(2800, 3900), rng.uniform(0.004, 0.008), 0.14)]
    else:
        modes = [(rng.uniform(300, 420),   rng.uniform(0.045, 0.070), 0.42),
                 (rng.uniform(640, 860),   rng.uniform(0.030, 0.045), 0.30),
                 (rng.uniform(1400, 1900), rng.uniform(0.012, 0.020), 0.16)]
    for f, decay, amp in modes:
        ph = rng.uniform(0, 2 * math.pi)
        for i in range(t0, n):
            t = (i - t0) / SR
            buf[i] += math.sin(2 * math.pi * f * t + ph) * math.exp(-t / decay) * amp

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
print('sample rate %d Hz, click %d ms, settle %d ms' % (SR, 55, 115))
print('embedded base64 total: %.1f KB' % (total / 1024.0))
