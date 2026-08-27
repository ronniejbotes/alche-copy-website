#!/bin/bash
# Build, deploy to the local Apache root, and serve with real .htaccess rules.
#
# The one thing this MUST do every time: strip the canonical-host and HTTPS
# redirect block from the served copy. Those rules 301 any non-canonical host
# to https://www.positionxero.com, so without the strip, localhost forwards
# straight to the live site. The repo copy at public/.htaccess keeps the block.
set -e
cd "$(dirname "$0")/../.."

SP="${PX_SERVE_DIR:-/private/tmp/px-local}"
CONF="${PX_CONF:-/private/tmp/px-local.conf}"
PORT="${PX_PORT:-8899}"

npx vite build --logLevel error

rm -rf "$SP"; mkdir -p "$SP"
cp -R dist/. "$SP/"

python3 - "$SP/.htaccess" <<'PY'
import sys, io
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
marker = '# Canonical host + HTTPS in a SINGLE hop'
if marker not in s:
    print('  [warn] canonical-host block not found; .htaccess may have changed')
    raise SystemExit(0)
a = s.rindex('# ' + '-' * 75, 0, s.index(marker))
b = s.index('# Long-cache static assets')
io.open(p, 'w', encoding='utf-8').write(
    s[:a] + '# [local preview] canonical host + HTTPS redirects removed so\n'
            '# localhost is browsable. The repo copy still has them.\n\n' + s[b:])
print('  canonical-host redirect stripped from the served copy')
PY

chmod -R a+rX "$SP"

sed "s#__DOCROOT__#$SP#g; s#Listen .*#Listen $PORT#" \
    tools/verify/httpd.conf.template > "$CONF"

/usr/sbin/httpd -f "$CONF" -k restart 2>/dev/null || /usr/sbin/httpd -f "$CONF" -k start
sleep 1

code=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "http://localhost:$PORT/")
if [[ "$code" == 301* ]]; then
  echo "  FAIL: / returns $code -- the redirect strip did not take"
  exit 1
fi
echo "  serving $SP on http://localhost:$PORT/  (/ returns ${code% *})"
