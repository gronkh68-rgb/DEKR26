# DEKR26 – Beipack-Abholung

Statische Hilfswebsite (GitHub Pages). Mitarbeiter melden per Handy (QR-Code) „KR + Position fertig“, auf der Hauptseite wird die Position grün.

| Seite | Zweck |
|---|---|
| `index.html` | Dashboard: links KR je Wochentag (Mo–Fr), Mitte Hallenkarte (Umschalter oben rechts), rechts Nachrichten |
| `scan.html` | Handy-Meldung (Name, KR, Position → FERTIG). Die Halle ergibt sich aus der Position. QR-Codes erstellst du im Dashboard (Button „QR-Codes"); `?n=Team 1` legt den Namen fest (dann nicht änderbar) |

## Live-Betrieb (mehrere Handys)
Ohne Konfiguration läuft der **LOKAL-DEMO-Modus** (Daten nur im eigenen Browser). Für Live-Sync:

1. Firebase-Projekt anlegen → *Realtime Database* erstellen (Region Europa).
2. Regeln (ohne Login, nur für internen Kurzzeit-Einsatz):
   `{ "rules": { ".read": true, ".write": true } }`
3. Datenbank-URL in `js/config.js` bei `firebaseUrl` eintragen und committen.
4. GitHub → Settings → Pages → Branch wählen → Adresse für die QR-Codes verwenden (`…/scan.html?n=Name`).

Achtung: Mit offenen Regeln kann jeder mit der URL schreiben. Keine sensiblen Daten eintragen.

## Hallenpläne
`js/halls.js`: Halle 7.1 ist nachgezeichnet (SVG `PLAN_H7`), Positionen A–Z (oben→unten) × 1–49 (links→rechts) als Raster `grid` darüber. Lage des Rasters über `grid.x/y/w/h` justieren. Halle 2 ist noch ein Platzhalter-Raster (ohne `grid`/`plan`).

## Lokal testen
`python3 -m http.server` im Repo-Ordner, dann `http://localhost:8000`.

## Push-Nachricht bei „Beipack fertig" (optional)
Eine statische Seite kann nicht selbst Push senden. Kostenlos geht es über **ntfy.sh**:
1. In `js/config.js` bei `ntfyTopic` ein langes, zufälliges Thema eintragen (wie ein Passwort), z. B. `dekr26-k8f3x9q2m7`.
2. Auf dem Handy die App **ntfy** installieren und dieses Thema abonnieren (oder `https://ntfy.sh/<Thema>` im Browser öffnen).
3. Ab dann kommt bei jeder „Fertig"-Meldung eine Push-Nachricht.

Achtung: Der Text der Meldung (KR, Position, Name) läuft dabei über ntfy.sh, und jeder, der das Thema kennt, kann mitlesen. Ohne Eintrag ist die Funktion aus.

Ohne ntfy gibt es im QR-Typ „Mobiles Dashboard" Benachrichtigungen, solange die Seite auf dem Handy geöffnet ist (Knopf „Benachrichtigungen aktivieren").
