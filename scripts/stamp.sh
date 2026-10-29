#!/bin/sh
# Nach dem Commit ausführen: trägt Build (Kurz-Hash), Datum in js/version.js und version.json ein und setzt die Cache-Buster (?v=) in den HTML-Seiten.
# Danach den Stempel mit „git commit -am Stempel“ einchecken. Die Versionsnummer (n) wird in js/version.js von Hand erhöht.
set -e
cd "$(dirname "$0")/.."
H=$(git rev-parse --short HEAD); D=$(date +%Y-%m-%d)
N=$(sed -n "s/.*n: '\([^']*\)'.*/\1/p" js/version.js | head -1)
sed -i "s/b: '[0-9a-f]*'/b: '$H'/; s/d: '[0-9-]*'/d: '$D'/" js/version.js
printf '{"n":"%s","b":"%s","d":"%s"}\n' "$N" "$H" "$D" > version.json
sed -i -E "s#(js/[a-z0-9-]+\.js|css/[a-z0-9-]+\.css)\?v=[0-9a-zA-Z]+#\1?v=$H#g" index.html scan.html mipp.html
echo "Version $N, Build $H, $D"
