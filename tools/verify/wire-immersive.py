#!/usr/bin/env python3
"""Wire public/js/immersive.js into every legacy page, after main.js.

The legacy pages all load `<script src="/js/main.js" defer></script>`. The
immersive interaction layer is additive and must run after it, so it is
inserted immediately following that tag. Idempotent: running twice is a no-op.

Usage:  python3 tools/verify/wire-immersive.py [--check]
"""
import glob, io, re, sys

TAG_MAIN = '<script src="/js/main.js" defer></script>'
TAG_NEW  = '<script src="/js/immersive.js" defer></script>'
check = '--check' in sys.argv

files = sorted(glob.glob('public/*.html')) + sorted(glob.glob('public/blog/*.html'))
wired = already = missing = 0

for f in files:
    s = io.open(f, encoding='utf-8').read()
    if TAG_NEW in s:
        already += 1
        continue
    if TAG_MAIN not in s:
        # some pages may use a different attribute order
        m = re.search(r'<script[^>]*src="/js/main\.js"[^>]*></script>', s)
        if not m:
            missing += 1
            print(f'  NO main.js TAG: {f}')
            continue
        anchor = m.group(0)
    else:
        anchor = TAG_MAIN
    if not check:
        io.open(f, 'w', encoding='utf-8').write(s.replace(anchor, anchor + '\n  ' + TAG_NEW, 1))
    wired += 1

verb = 'would wire' if check else 'wired'
print(f'{verb}: {wired}   already wired: {already}   no anchor: {missing}   total: {len(files)}')
