"""Turns your original photos into small WebP files for the web page.

Put your photos in the folder  originals/  and name them like the categories:
  cables.jpg, chargers.jpg, phone-cases.jpg, screen-protectors.jpg, headphones.jpg,
  power-banks.jpg, adapters-and-hubs.jpg, memory-and-storage.jpg, batteries.jpg, holders-and-mounts.jpg
(you do not need all ten; a missing one shows an icon instead).

Run:  python3 tools/optimise.py
Result: public/img/original/  (JPEG copies, used for the BEFORE measurement)
        public/img/optimised/ (WebP, max 480 px wide, quality 80, used for the AFTER measurement)
"""
import os, sys
from PIL import Image

SRC, ORIG, OPT = 'originals', 'public/img/original', 'public/img/optimised'
MAX_W, QUALITY = 480, 80
os.makedirs(ORIG, exist_ok=True); os.makedirs(OPT, exist_ok=True)

files = [f for f in sorted(os.listdir(SRC)) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
if not files:
    sys.exit('No photos found in originals/. Add .jpg or .png files first.')

print('| File | Original px | Original KB | WebP px | WebP KB | Saved |')
print('|---|---|---|---|---|---|')
tot_o = tot_n = 0
for f in files:
    name = os.path.splitext(f)[0]
    im = Image.open(os.path.join(SRC, f)).convert('RGB')
    # keep the full-size original as JPEG so the page can load /img/original/<name>.jpg in "before" mode
    im.save(os.path.join(ORIG, name + '.jpg'), 'JPEG', quality=95)
    small = im.copy()
    if small.width > MAX_W:
        small = small.resize((MAX_W, round(small.height * MAX_W / small.width)), Image.LANCZOS)
    small.save(os.path.join(OPT, name + '.webp'), 'WEBP', quality=QUALITY)
    o = os.path.getsize(os.path.join(ORIG, name + '.jpg')) / 1024
    n = os.path.getsize(os.path.join(OPT, name + '.webp')) / 1024
    tot_o += o; tot_n += n
    print(f'| {name} | {im.width}x{im.height} | {o:.0f} | {small.width}x{small.height} | {n:.0f} | {100 - 100 * n / o:.0f}% |')
print(f'| TOTAL | | {tot_o:.0f} | | {tot_n:.0f} | {100 - 100 * tot_n / tot_o:.0f}% |')
