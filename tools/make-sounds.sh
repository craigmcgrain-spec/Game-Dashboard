#!/usr/bin/env bash
# Generates Silly Pinball's sound effects as WAV files.
#
# WAV only, deliberately. JavaFX WebView has no Web Audio API at all, and its HTML5 <audio>
# runs through jfxmedia, which rejects MP3 and OGG ("Unrecognized file signature!") but plays
# PCM WAV fine. Runtime synthesis is impossible too — the WebView rejects data: URLs — so the
# effects have to exist as real files. They are committed, so the game itself needs no build
# step; nothing at game runtime calls this script.
#
# Usage: tools/make-sounds.sh
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/games/silly-pinball/sounds"
mkdir -p "$OUT"

python3 - "$OUT" <<'PY'
import math, os, struct, sys, wave

out = sys.argv[1]
RATE = 22050


def write(name, samples):
    path = os.path.join(out, name + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(
            struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples
        ))


def env(i, n, attack=0.02, release=0.45):
    a = max(1, int(n * attack))
    r = max(1, int(n * release))
    if i < a:
        return i / a
    if i > n - r:
        return max(0.0, (n - i) / r)
    return 1.0


def tone(freq, dur, kind='sine', vol=0.5, freq2=None):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        f = freq if freq2 is None else freq + (freq2 - freq) * (i / n)
        ph = 2 * math.pi * f * t
        if kind == 'sine':
            v = math.sin(ph)
        elif kind == 'square':
            v = 1.0 if math.sin(ph) >= 0 else -1.0
        else:
            v = 2 / math.pi * math.asin(math.sin(ph))
        out.append(v * vol * env(i, n))
    return out


def normalise(samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    return [s / peak * 0.9 for s in samples]


def seq(*tracks):
    out = []
    for t in tracks:
        out.extend(t)
    return normalise(out)


def mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, s in enumerate(t):
            out[i] += s
    return normalise(out)


write('flipper', tone(900, 0.05, 'square', 0.5, 420))
write('bumper1', tone(620, 0.12, 'square', 0.6, 900))
write('bumper2', tone(740, 0.12, 'square', 0.6, 1080))
write('bumper3', tone(880, 0.12, 'square', 0.6, 1260))
write('sling', tone(380, 0.08, 'square', 0.5, 760))
write('target', tone(1200, 0.06, 'square', 0.45, 600))
write('bank', seq(tone(660, 0.09, 'square', 0.5),
                  tone(880, 0.09, 'square', 0.5),
                  tone(1320, 0.14, 'square', 0.5)))
write('spinner', tone(1500, 0.04, 'square', 0.35, 900))
write('kicker', tone(240, 0.22, 'tri', 0.55, 900))
write('launch', tone(180, 0.28, 'tri', 0.55, 1100))
write('drain', seq(tone(440, 0.16, 'tri', 0.45),
                   tone(330, 0.16, 'tri', 0.45),
                   tone(220, 0.22, 'tri', 0.45)))
write('save', seq(tone(520, 0.1, 'square', 0.45),
                  tone(780, 0.14, 'square', 0.45)))
write('extra', seq(tone(660, 0.1, 'square', 0.5),
                   tone(990, 0.1, 'square', 0.5),
                   tone(1320, 0.18, 'square', 0.5)))
write('multiball', seq(tone(523, 0.1, 'square', 0.5),
                       tone(659, 0.1, 'square', 0.5),
                       tone(784, 0.1, 'square', 0.5),
                       tone(1047, 0.2, 'square', 0.5)))
write('cheer', mix(tone(523, 0.35, 'tri', 0.4),
                   tone(659, 0.35, 'tri', 0.35),
                   tone(784, 0.35, 'tri', 0.35)))
write('nudge', tone(120, 0.08, 'tri', 0.5, 70))
write('tilt', seq(tone(300, 0.09, 'tri', 0.45),
                  tone(260, 0.09, 'tri', 0.45),
                  tone(210, 0.14, 'tri', 0.45)))

names = sorted(f for f in os.listdir(out) if f.endswith('.wav'))
print('wrote %d sounds to %s' % (len(names), out))
PY

du -sh "$OUT"
