# DEUKRO26 MIPP-Import (Edge-Erweiterung)

Öffnet die MIPP-Auslieferliste in festen Abständen in einem eigenen Hintergrund-Tab, wartet 10 Sekunden, liest sie aus,
importiert sie in die DEUKRO26-Datenbank und schließt den Tab wieder. Dieselbe Logik wie das Lesezeichen (`js/mipp.js`),
ausgelagert in `lib.js`.

## Einrichten
1. `deukro-mipp-edge.zip` von `mipp.html` laden und entpacken (Ordner behalten).
2. Edge: `edge://extensions`, „Entwicklermodus" einschalten, „Entpackte Erweiterung laden", Ordner wählen.
3. Symbol der Erweiterung anklicken, „Einrichtung": Einrichtungscode (von `mipp.html`, im Dashboard-Browser angemeldet) einfügen,
   MIPP-Adresse eintragen (oder „Adresse des aktuellen Tabs"), Speichern. Edge fragt einmal nach dem Zugriff auf die MIPP-Domain.
4. „Jetzt importieren" zum Testen. Danach läuft es von selbst (Vorgabe alle 60 Minuten, wählbar 15/30/60).

## Hinweise
- Edge muss laufen. Der Zeitgeber ist ein Edge-Alarm und überlebt das Schließen des Fensters nur, solange Edge im Hintergrund läuft.
- MIPP muss in diesem Edge angemeldet sein, sonst meldet die Erweiterung „Keine Liste gefunden".
- Der Einrichtungscode enthält den Zugang des Erzeugers und liegt im lokalen Speicher der Erweiterung. Nicht weitergeben.
- Nach Änderungen an `extension/`: `sh scripts/build-extension.sh` (packt die ZIP und setzt die Version).
