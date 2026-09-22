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
    """A relay click, tuned against measured reference recordings.

    The references sit brighter and further forward than a wooden or a
    ringing-metal strike: spectral centroid around 3.0-3.8 kHz, better than
    half the energy between 800 Hz and 4 kHz, and only about 8 per cent below
    300 Hz. So the low knock is only a trace here -- enough to give the strike
    weight without turning it into a thud -- and the work is done by two
    mid modes and a short bright one on top. Each flap is a single click:
    the "click click" is the rate, not a doubled event.
    """
    rng = random.Random(seed)
    dur = 0.040 if kind == 'click' else 0.075
    n   = int(dur * SR)
    buf = [0.0] * n
    at  = int(0.003 * SR)
    tail = n - at

    # contact burst, only lightly tamed so it keeps the reference's brightness
    raw  = [rng.uniform(-1, 1) for _ in range(tail)]
    band = lp(raw, 0.45)          # fitted to the reference brightness
    tau  = rng.uniform(0.0015, 0.0025) if kind == 'click' else rng.uniform(0.0026, 0.0038)
    for i in range(tail):
        buf[at + i] += band[i] * math.exp(-(i / SR) / tau)

    if kind == 'click':
        modes = [(rng.uniform(175, 240),   rng.uniform(0.008, 0.012), 0.13),
                 (rng.uniform(420, 650),   rng.uniform(0.008, 0.013), 0.16),
                 (rng.uniform(1100, 1600), rng.uniform(0.006, 0.010), 0.28),
                 (rng.uniform(2400, 3200), rng.uniform(0.004, 0.007), 0.26),
                 (rng.uniform(4200, 5200), rng.uniform(0.002, 0.004), 0.03)]
    else:
        modes = [(rng.uniform(150, 200),   rng.uniform(0.016, 0.024), 0.18),
                 (rng.uniform(380, 560),   rng.uniform(0.014, 0.020), 0.18),
                 (rng.uniform(900, 1300),  rng.uniform(0.012, 0.018), 0.30),
                 (rng.uniform(2100, 2800), rng.uniform(0.007, 0.011), 0.24),
                 (rng.uniform(3800, 4600), rng.uniform(0.004, 0.006), 0.04)]

    for f, dec, amp in modes:
        ph = rng.uniform(0, 2 * math.pi)
        for i in range(tail):
            t = i / SR
            buf[at + i] += math.sin(2 * math.pi * f * t + ph) * math.exp(-t / dec) * amp

    fade = int(0.0025 * SR)
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
print('sample rate %d Hz, click %d ms, settle %d ms' % (SR, 40, 75))
print('embedded base64 total: %.1f KB' % (total / 1024.0))
