# DEUKRO26 – Beipack-Abholung

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

## Geräte-Freigabe und Admin-Login (optional, empfohlen)
Damit nur freigegebene Geräte die Daten lesen und schreiben können (und das Layout/die QR-Codes nur du als Admin änderst):

1. **Firebase-Konsole → Authentication → Anmeldemethode:** „Anonym" und „E-Mail/Passwort" aktivieren.
2. **Authentication → Nutzer → Nutzer hinzufügen:** Admin-E-Mail und Passwort anlegen. Die **Nutzer-UID** kopieren.
3. **Realtime Database → Regeln:** den Inhalt von `firebase-rules.json` einfügen, **`ADMIN_UID` überall durch die UID ersetzen** (6 Stellen), „Veröffentlichen". Das ersetzt auch den 30-Tage-Testmodus.
4. **Projekteinstellungen → Allgemein → Web-API-Schlüssel** kopieren und in `js/config.js` bei `authApiKey` eintragen.
5. Dashboard öffnen: Es zeigt „Gerät wartet auf Freigabe". Dort mit der Admin-E-Mail anmelden. Danach erscheinen neue Geräte unter **Admin → Geräte** (mit Name und Gerätecode) zum **Freigeben**.

So funktioniert es: Jedes Gerät meldet sich anonym an und bekommt einen Gerätecode. Ohne Freigabe sieht es nichts und kann nichts ändern. Löscht ein Gerät seine Browserdaten, braucht es eine neue Freigabe. Layout, QR-Codes und Podest-Liste kann nur der angemeldete Admin ändern.

## Betrieb und Technik (Stand der Überarbeitung)
- **Adresse:** `https://deukro26.de/` (GitHub Pages, Domain bei IONOS, Datei `CNAME`).
- **Datenmenge:** Die Seiten laden die Datenbank einmal und bekommen danach nur noch Änderungen (Live-Stream). Mehrere Änderungen (z. B. Import) gehen in einer Anfrage raus. Als Admin angemeldet, räumt das Dashboard einmal pro Sitzung auf: Nachrichten > 14 Tage, erledigte Bestellungen/gelöste Probleme > 30 Tage und KR-Einträge älter als 8 Wochen werden gelöscht.
- **Sicherung:** Admin → „Daten sichern" lädt alle Daten als JSON-Datei herunter.
- **Sicherheit:** Content-Security-Policy in den Seiten (nur eigene Skripte, nur Verbindungen zu Firebase und ntfy), Suchmaschinen sind per `noindex`/`robots.txt` ausgeschlossen. Ein gelöschter QR-Code ist sofort ungültig.
