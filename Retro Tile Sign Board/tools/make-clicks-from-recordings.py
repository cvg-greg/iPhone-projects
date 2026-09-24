#!/usr/bin/env python3
"""Build the board's click samples from the source recordings in recordings/.

The recordings are of a real mechanical clicker, made for this project. A
strike is not a clean event: it slides, it scrapes, it rings a little, and no
two are alike. That mess is the point, so the processing here is deliberately
light -- enough to stop one strike bleeding into the next, and no more. Gating
it hard made the board sound like a machine that had never been used.

A window is taken around one onset, sized to the gap before the next, gently
band-limited, and given a soft decay well after the strike has happened, which
leaves the natural tail intact while stopping the recording's noise floor
running on forever across the few hundred voices a sweep plays.

Levels are NOT evened out. Each strike keeps its own loudness relative to the
others -- the set is scaled by one common factor -- because some hits really
are harder than others, and flattening that is what makes a board sound
sequenced rather than mechanical.

Strikes are taken from both recordings, and spread across the range of
loudness rather than picking the best, so the board has variety to draw on.

Needs ffmpeg on PATH to decode the .m4a sources. Prints the JavaScript block
to paste over CLICK_WAV and THUNK_WAV in index.html.
"""
import wave, struct, math, base64, io, os, subprocess, sys, tempfile

SR_OUT = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = [('clicks-a.m4a', 4), ('clicks-b.m4a', 2)]   # file, strikes to take

def decode(path):
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, 'x.wav')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path,
                        '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', out], check=True)
        w = wave.open(out, 'rb'); sr = w.getframerate(); n = w.getnframes()
        return sr, [x / 32768.0 for x in struct.unpack('<%dh' % n, w.readframes(n))]

def hp1(d, fc, sr):
    a = math.exp(-2 * math.pi * fc / sr); out = []; px = py = 0.0
    for x in d:
        y = a * (py + x - px); out.append(y); px = x; py = y
    return out

def lp1(d, fc, sr):
    a = 1 - math.exp(-2 * math.pi * fc / sr); out = []; p = 0.0
    for x in d:
        p = p + a * (x - p); out.append(p)
    return out

def onsets(d, sr, thr=0.18, gap_ms=25):
    hop = int(sr * 0.001); e = []
    for i in range(0, len(d) - hop, hop):
        s = sum(x * x for x in d[i:i + hop]); e.append(math.sqrt(s / hop))
    mx = max(e) or 1; e = [v / mx for v in e]
    out = []; last = -10 ** 9
    for i in range(1, len(e)):
        if e[i] > thr and e[i - 1] <= thr and i - last > gap_ms:
            out.append(i); last = i
    return out

def extract(d, sr, onset_ms, win_ms, keep_ms=14.0, tau_ms=18.0, rise_ms=1.2, norm=True):
    st = int((onset_ms - 3) / 1000 * sr); n = int(win_ms / 1000 * sr)
    seg = d[st:st + n]
    if len(seg) < n:
        seg = seg + [0.0] * (n - len(seg))
    seg = lp1(hp1(seg, 90, sr), 11000, sr)
    look = min(len(seg), int(0.012 * sr))          # the strike asked for, not a louder neighbour
    pki = max(range(look), key=lambda i: abs(seg[i]))
    keep = int(keep_ms / 1000 * sr); tau = tau_ms / 1000 * sr
    for i in range(len(seg)):
        if i > pki + keep:
            seg[i] *= math.exp(-(i - (pki + keep)) / tau)
    f = int(0.004 * sr)
    for i in range(f):
        seg[len(seg) - 1 - i] *= i / f
    r = int(rise_ms / 1000 * sr)                   # a gentle onset: a tick, not a snap
    for i in range(min(r, len(seg))):
        seg[i] *= 0.5 - 0.5 * math.cos(math.pi * i / r)
    if not norm:
        return seg
    pk = max(abs(x) for x in seg) or 1
    return [x / pk * 0.95 for x in seg]

def resample(d, src, dst):
    out = []; step = src / dst; i = 0.0
    while i < len(d) - 1:
        k = int(i); fr = i - k; out.append(d[k] * (1 - fr) + d[k + 1] * fr); i += step
    return out

def wav_b64(s):
    raw = b''.join(struct.pack('<h', max(-32768, min(32767, int(v * 32767)))) for v in s)
    bio = io.BytesIO(); w = wave.open(bio, 'wb')
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR_OUT)
    w.writeframes(raw); w.close()
    return base64.b64encode(bio.getvalue()).decode('ascii')

def candidates(d, sr):
    on = onsets(d, sr); out = []
    for k, o in enumerate(on):
        gap = (on[k + 1] - o) if k + 1 < len(on) else 600
        st = int(o / 1000 * sr)
        pk = max(abs(x) for x in d[st:min(len(d), st + int(sr * 0.012))]) if st < len(d) else 0
        if gap >= 40:
            out.append((pk, gap, o))
    out.sort(reverse=True)
    return out

clicks = []; settle = None
for fname, want in SOURCES:
    sr, d = decode(os.path.join(HERE, 'recordings', fname))
    cands = candidates(d, sr)
    # spread the picks across the loudness range instead of taking the top few
    pool = sorted(cands, key=lambda c: -c[1])[:max(want * 3, want)]
    pool.sort(key=lambda c: -c[0])
    step = max(1, len(pool) // want)
    for pk, gap, o in [pool[min(i * step, len(pool) - 1)] for i in range(want)]:
        clicks.append(resample(extract(d, sr, o, min(52, gap - 2), norm=False), sr, SR_OUT))
    # the settle needs room to run, so it is chosen for the gap after it first
    for pk, gap, o in cands:
        key = (min(gap, 90), pk)
        if settle is None or key > settle[0]:
            settle = (key, gap, o, sr, d)

# a landing is allowed more weight and a longer tail than a passing flap
_, gap, o, sr, d = settle
thunk = resample(extract(d, sr, o, min(95, gap - 3), keep_ms=22.0, tau_ms=30.0, rise_ms=1.6,
                         norm=False), sr, SR_OUT)

# Keep the strikes' loudness differences, but only just. Straight off the
# recording the set ran 20 dB apart, which reads as six different sounds; the
# strikes should be near enough the same that you hear one mechanism, and
# different enough that you never hear a loop. This pulls the range down to
# about 4 dB while leaving the ordering intact.
SPREAD = 0.8                          # 1.0 would make them identical
peaks = [max(abs(v) for v in c) or 1e-9 for c in clicks]
top = max(peaks)
clicks = [[v / top * (top / pk) ** SPREAD * 0.95 for v in c]
          for c, pk in zip(clicks, peaks)]
lim = max(max(abs(v) for v in c) for c in clicks) or 1.0
clicks = [[v / lim * 0.95 for v in c] for c in clicks]

# the settle carries its own level: a landing should be heard arriving
tp = max(abs(v) for v in thunk) or 1.0
thunk = [v / tp * 0.95 for v in thunk]

lines = ['/* Six strikes and one settle, isolated from the recordings in',
         '   tools/recordings/ and gated so their noise floor does not stack across',
         '   the hundreds of voices a sweep plays. Rebuilt by',
         '   tools/make-clicks-from-recordings.py. */',
         'const CLICK_WAV = [']
for c in clicks:
    lines.append("  '" + wav_b64(c) + "',")
lines.append('];')
lines.append("const THUNK_WAV = '" + wav_b64(thunk) + "';")
open(os.path.join(HERE, 'clicks.js.frag'), 'w').write('\n'.join(lines))

total = sum(len(wav_b64(c)) for c in clicks) + len(wav_b64(thunk))
print('%d strikes + 1 settle from %d recordings' % (len(clicks), len(SOURCES)))
print('%d Hz, strikes %d ms, settle %d ms' %
      (SR_OUT, len(clicks[0]) / SR_OUT * 1000, len(thunk) / SR_OUT * 1000))
print('embedded base64 total: %.1f KB' % (total / 1024.0))
