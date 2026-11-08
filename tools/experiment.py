"""Part A2 experiment: saves ONE image of your project in four versions and measures them.

Run:  python3 tools/experiment.py path/to/your_screenshot.png
Result in the folder experiment/ :
  - the files (PNG, JPEG q80, JPEG q40, WebP q80)
  - side_by_side.png : the same crop of each version at 100% zoom (screenshot it for the report)
  - a Markdown table printed in the terminal (copy it into the report)
"Visible quality" (sharp / acceptable / poor) is YOUR judgement: look at side_by_side.png and fill that column.
"""
import os, sys, math
from PIL import Image, ImageDraw

if len(sys.argv) < 2:
    sys.exit('Usage: python3 tools/experiment.py path/to/image.png')
src = sys.argv[1]
os.makedirs('experiment', exist_ok=True)
im = Image.open(src).convert('RGB')
base = os.path.splitext(os.path.basename(src))[0]

versions = [
    (f'{base}.png',     'PNG (lossless)',  dict(format='PNG', optimize=True)),
    (f'{base}_q80.jpg', 'JPEG quality 80', dict(format='JPEG', quality=80)),
    (f'{base}_q40.jpg', 'JPEG quality 40', dict(format='JPEG', quality=40)),
    (f'{base}.webp',    'WebP quality 80', dict(format='WEBP', quality=80)),
]

def psnr(a, b):
    """Objective similarity in dB (higher = closer to the original). Needs numpy; skipped if missing."""
    try:
        import numpy as np
    except ImportError:
        return None
    x = np.asarray(a, dtype='float64'); y = np.asarray(b, dtype='float64')
    mse = ((x - y) ** 2).mean()
    return float('inf') if mse == 0 else 10 * math.log10(255 ** 2 / mse)

rows, crops = [], []
cw, ch = min(400, im.width), min(300, im.height)
x0, y0 = (im.width - cw) // 2, (im.height - ch) // 2
for fname, label, opts in versions:
    path = os.path.join('experiment', fname)
    im.save(path, **opts)
    kb = os.path.getsize(path) / 1024
    back = Image.open(path).convert('RGB')
    rows.append((fname, label, f'{im.width} x {im.height}', kb, psnr(im, back)))
    c = back.crop((x0, y0, x0 + cw, y0 + ch)).copy()
    d = ImageDraw.Draw(c)
    d.rectangle((0, 0, cw, 16), fill=(255, 255, 255))
    d.text((4, 2), f'{label}  {kb:.0f} KB', fill=(0, 0, 0))
    crops.append(c)

sheet = Image.new('RGB', (cw * 2 + 30, ch * 2 + 30), (200, 200, 200))
for i, c in enumerate(crops):
    sheet.paste(c, (10 + (i % 2) * (cw + 10), 10 + (i // 2) * (ch + 10)))
sheet.save('experiment/side_by_side.png')

print('| File | Format and setting | Resolution | File size (KB) | PSNR (dB) | Visible quality |')
print('|---|---|---|---|---|---|')
for f, l, r, kb, p in rows:
    ps = '-' if p is None else ('lossless' if p == float('inf') else f'{p:.1f}')
    print(f'| {f} | {l} | {r} | {kb:.0f} | {ps} | (fill in) |')
print('\nSaved: experiment/side_by_side.png (open it at 100% zoom and take a screenshot)')
