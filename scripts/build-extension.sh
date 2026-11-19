#!/bin/sh
# Packt extension/ als ZIP für die Seite (mipp.html bietet den Download an). Nach Änderungen an extension/ ausführen.
set -e
cd "$(dirname "$0")/.."
N=$(sed -n "s/.*n: '\([^']*\)'.*/\1/p" js/version.js | head -1)
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$N\"/" extension/manifest.json
python3 - <<'PY'
import zipfile, os
z = zipfile.ZipFile('extension/deukro-mipp-edge.zip', 'w', zipfile.ZIP_DEFLATED)
for f in sorted(os.listdir('extension')):
    if f.endswith('.zip') or f == 'README.md':
        continue
    z.write(os.path.join('extension', f), f)
z.close()
PY
echo "Erweiterung $N gepackt"
