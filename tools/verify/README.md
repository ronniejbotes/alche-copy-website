# URL parity verification

Proves the rebuilt site answers every URL `positionxero.com` answers today, at the
identical string, with zero redirect hops. This is the acceptance test for the
migration's core constraint: no 301s, so no ranking loss.

It runs the real `.htaccess` through real Apache. Reading the config is not enough,
because the rules interact (the `!-d` guard, `DirectorySlash`, the `THE_REQUEST`
loop guards) in ways only execution settles.

## Run it

```bash
npm run build

# macOS blocks the Apache worker from reading ~/Documents, so serve a copy
SITE=/tmp/pxverify && rm -rf $SITE && mkdir -p $SITE
cp -R dist/. $SITE/ && chmod -R a+rX $SITE

sed "s#__DOCROOT__#$SITE#g" tools/verify/httpd.conf.template > /tmp/pxverify.conf
/usr/sbin/httpd -f /tmp/pxverify.conf -k start

bash tools/verify/url-parity.sh

/usr/sbin/httpd -f /tmp/pxverify.conf -k stop
```

## What it asserts

| Group | Assertion | Count |
|---|---|---|
| A | every sitemap URL returns 200 with **zero** redirect hops | 50 |
| B | the trailing-slash variant of each also returns 200 | 48 |
| C | `/thank-you` reachable (the form's `_next` target) | 1 |
| D | robots.txt, sitemap.xml, llms.txt, pricing.md, site.webmanifest, IndexNow key | 6 |
| E | `/css/style.css`, `/js/main.js`, 19 files under `/img/` | 21 |
| F | every legacy `.html` URL 301s to its extensionless form in **one** hop, plus `/index.html`, `/blog/index.html`, `/seo-audit`, `/seo-audit.html` | 52 |
| G | an unknown path returns 404, `/404.html` returns 200 | 2 |
| H | internal markdown and `/seo-tool/` are not served | 2 |

Last full run: **181 pass, 1 known delta.**

## Known delta

`/CLAUDE.md` returns **403** locally and **404** on the live site. Both deny access.
The live site 404s via `RedirectMatch 404`; locally the `<FilesMatch "\.md$">
Require all denied` rule wins the phase ordering. The file is not shipped in `dist/`
at all, is linked from nowhere and is not indexed, so the difference has no
SEO consequence. Recorded rather than papered over.

## Why the Host header

`.htaccess` canonicalises any non-`www.positionxero.com` host to the canonical
origin in one hop. Requests therefore carry `Host: www.positionxero.com` and
`X-Forwarded-Proto: https`, which is also what proves the single-hop guarantee
holds for a request that is wrong on host, scheme and extension at once.
