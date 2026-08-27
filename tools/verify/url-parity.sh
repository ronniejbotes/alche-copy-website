#!/bin/bash
BASE=http://localhost:8899
HDR=(-H 'Host: www.positionxero.com' -H 'X-Forwarded-Proto: https')
OLD=~/Documents/GitHub/positionxero-website
pass=0; fail=0; failures=()

chk200() { # url
  read -r code hops < <(curl -s "${HDR[@]}" -o /dev/null -w '%{http_code} %{num_redirects}' "$BASE$1")
  if [ "$code" = "200" ] && [ "$hops" = "0" ]; then pass=$((pass+1));
  else fail=$((fail+1)); failures+=("200-check $1 -> $code hops=$hops"); fi
}
chk301() { # url expected-location
  read -r code loc < <(curl -s "${HDR[@]}" -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE$1")
  if [ "$code" = "301" ] && [ "$loc" = "$2" ]; then pass=$((pass+1));
  else fail=$((fail+1)); failures+=("301-check $1 -> $code $loc (want $2)"); fi
}
chkcode() { # url expected
  code=$(curl -s "${HDR[@]}" -o /dev/null -w '%{http_code}' "$BASE$1")
  if [ "$code" = "$2" ]; then pass=$((pass+1));
  else fail=$((fail+1)); failures+=("code-check $1 -> $code (want $2)"); fi
}

URLS=$(grep -o '<loc>[^<]*</loc>' "$OLD/sitemap.xml" | sed 's#<[^>]*>##g; s#https://www.positionxero.com##' )

echo "### A. 50 sitemap URLs, 200 with zero hops"
for u in $URLS; do [ -z "$u" ] && u=/; chk200 "$u"; done

echo "### B. trailing-slash variants must stay 200"
for u in $URLS; do case "$u" in ""|"/"|*/) ;; *) chk200 "$u/";; esac; done

echo "### C. out-of-sitemap pages"
chk200 /thank-you

echo "### D. public files"
for f in /robots.txt /sitemap.xml /llms.txt /pricing.md /site.webmanifest /9463965a349a951b010acd3896da0711.txt; do chk200 "$f"; done

echo "### E. assets"
chk200 /css/style.css; chk200 /js/main.js
for i in $(ls "$OLD/img"); do chk200 "/img/$i"; done

echo "### F. legacy .html -> extensionless, ONE hop"
for u in $URLS; do case "$u" in ""|"/"|*/) ;; *) chk301 "$u.html" "https://www.positionxero.com$u";; esac; done
chk301 /index.html https://www.positionxero.com/
chk301 /blog/index.html https://www.positionxero.com/blog/
chk301 /seo-audit https://www.positionxero.com/free-audit
chk301 /seo-audit.html https://www.positionxero.com/free-audit

echo "### G. 404 behaviour"
chkcode /this-page-does-not-exist 404
chkcode /404.html 200

echo "### H. blocked paths"
chkcode /CLAUDE.md 404
chkcode /seo-tool/README.md 404

echo
echo "PASS $pass   FAIL $fail"
for f in "${failures[@]}"; do echo "  FAIL: $f"; done
