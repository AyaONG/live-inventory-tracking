"""Creates public/media/alert.wav: a short two-tone notification sound (about 0.5 s, 44.1 kHz, 16-bit, mono).
Uses only the Python standard library. You can also generate your own sound in Audacity
(Generate > Tone) and export it as alert.wav; then write that as the source in the asset inventory."""
import math, struct, wave

RATE = 44100
def tone(freq, seconds, volume=0.4):
    n = int(RATE * seconds)
    for i in range(n):
        fade = min(1, i / 400, (n - i) / 400)          # short fade in/out avoids clicks
        yield int(32767 * volume * fade * math.sin(2 * math.pi * freq * i / RATE))

samples = list(tone(660, 0.2)) + [0] * 2000 + list(tone(880, 0.25))
with wave.open('public/media/alert.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', s) for s in samples))
print('Created public/media/alert.wav')
