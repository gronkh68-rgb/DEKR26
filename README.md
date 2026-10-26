# DEKR26 – Beipack-Abholung

Statische Hilfswebsite (GitHub Pages). Mitarbeiter melden per Handy (QR-Code) „KR + Position fertig“, auf der Hauptseite wird die Position grün.

| Seite | Zweck |
|---|---|
| `index.html` | Dashboard: links KR je Wochentag (Mo–Fr), Mitte Hallenkarte (Umschalter oben rechts), rechts Nachrichten |
| `scan.html` | Handy-Meldung (Name, KR, Position → FERTIG). Parameter: `?n=Team 1`, `?hall=H1` |
| `qr.html` | Erzeugt druckbare QR-Codes für `scan.html` |

## Live-Betrieb (mehrere Handys)
Ohne Konfiguration läuft der **LOKAL-DEMO-Modus** (Daten nur im eigenen Browser). Für Live-Sync:

1. Firebase-Projekt anlegen → *Realtime Database* erstellen (Region Europa).
2. Regeln (ohne Login, nur für internen Kurzzeit-Einsatz):
   `{ "rules": { ".read": true, ".write": true } }`
3. Datenbank-URL in `js/config.js` bei `firebaseUrl` eintragen und committen.
4. GitHub → Settings → Pages → Branch wählen → URL in `qr.html` als Basis-URL verwenden.

Achtung: Mit offenen Regeln kann jeder mit der URL schreiben. Keine sensiblen Daten eintragen.

## Hallenpläne
`js/halls.js`: aktuell Platzhalter-Raster. Für echte Grundrisse `image`, `width`, `height` und `positions: [{id:'A14', x, y, w, h}]` pro Halle eintragen.

## Lokal testen
`python3 -m http.server` im Repo-Ordner, dann `http://localhost:8000`.
