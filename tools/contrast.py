"""Part B3: checks text/background colour pairs against the WCAG 4.5:1 rule.
Edit PAIRS to match the colours used in public/index.html, run:  python3 tools/contrast.py"""
def lum(hex_):
    r, g, b = [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

PAIRS = [
    ('Body text on page background',  '#1b2430', '#f6f8fb'),
    ('Body text on white card',       '#1b2430', '#ffffff'),
    ('White text on blue button',     '#ffffff', '#1f5fbf'),
    ('LOW badge on alert row',        '#b42318', '#fdecea'),
    ('Success message on white',      '#067647', '#ffffff'),
]
print('| Pair | Foreground | Background | Ratio | Passes 4.5:1 |')
print('|---|---|---|---|---|')
for name, fg, bg in PAIRS:
    r = ratio(fg, bg)
    print(f'| {name} | {fg} | {bg} | {r:.2f}:1 | {"yes" if r >= 4.5 else "NO"} |')
