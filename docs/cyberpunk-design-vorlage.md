# Vorlage: Cyberpunk-Design (aus DEUKRO26)

Beschreibung zum Wiederverwenden in neuen Projekten. Quelle der Umsetzung: `css/cyber.css`, `css/login.css`, `js/theme.js`.
Reines HTML/CSS/JS ohne Build-Schritt. Alle Farben laufen über CSS-Variablen, alle Effekte sind abschaltbar.

## 1. Grundlagen

**Fonts:** Orbitron (Logo, große Zahlen, Boot/Screensaver), Rajdhani 700/800 (Knöpfe, Tabs, Überschriften, immer `text-transform: uppercase; letter-spacing: .08–.12em`), Share Tech Mono (Fließtext, Daten, Terminal).

**Variablen (`:root`):**
```css
--bg:#05060b; --panel:#0b0d14; --panel2:#10131c; --line:#2a2d12;
--accent:#fcee09; --acc-rgb:252,238,9;   /* Hauptfarbe (Gelb), RGB-Tripel für rgba(var(--acc-rgb),.3) */
--cyan:#00f0ff;  --cy-rgb:0,240,255;     /* Nebenfarbe */
--green:#2dffb3; /* OK/fertig */  --red:#ff2a55; /* Problem/Alarm */
--text:#e8f9ff;  --dim:#7a8a96;
```
Immer `rgba(var(--acc-rgb), x)` für Glows verwenden, damit Farbwechsel überall wirkt.

**Hintergrund:** fast schwarz, zwei Farbschimmer (Cyan oben links, Rot unten rechts), darüber Scanlines `repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px)`. Dazu Vignette als `body::after` (fixed, `radial-gradient(transparent 60%, rgba(0,0,0,.55))`, `pointer-events:none`).

**Grundregel Form:** keine Rundungen (`border-radius:0`), stattdessen **abgeschrägte Ecken mit `clip-path`**:
- Knöpfe: `polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)`
- Karten: oben rechts und unten links 12–14 px abgeschnitten
- Tabs/Logo/Hervorhebung: Parallelogramm `polygon(0 0,100% 0,calc(100% - 14px) 100%,0 100%)`

## 2. Bausteine

| Element | Look |
|---|---|
| **Kopfzeile** | dunkler Verlauf, 2 px Akzent-Unterkante, darunter ein 38 % breiter Streifen aus Akzent-Strichen (`repeating-linear-gradient(90deg, accent 0 14px, transparent 14px 20px)`). Titel = Akzent-Parallelogramm mit schwarzer Schrift, flackert leise (Keyframe `cpFlick`, 7 s, Opazität springt kurz auf .55). |
| **Karte** | Verlauf `#0e1119 → #0a0c13`, 1 px dunkler Rand, **4 px farbiger linker Rand** (Akzent, grün = OK, grau = erledigt), Ecken geschnitten. Hover: leichtes Verschieben um 2 px nach rechts + innerer Glow in der Randfarbe. |
| **Spaltentitel** | Cyan, Unterlinie in Cyan 35 %, vor dem Text `// ` in Akzent. |
| **Heute-Markierung** | Akzent-Parallelogramm mit schwarzer Schrift. |
| **Chips/Badges** | eckig, farbiger Rand + gleichfarbige Schrift, Mono-Font, erledigt = grün mit 8 % grünem Fond. |
| **Zähler-Bubble** | rot, weiße Schrift, eckig. |
| **Eingaben** | `#0b0e16`, Rand `#3a3d18`, Fokus: Cyan-Rand + `box-shadow: 0 0 10px rgba(cy,.35)`. Fokusring 2 px Cyan. |
| **Modal** | 1 px Cyan-Rand, **8 Eck-Markierungen** (je 18×2 px bzw. 2×18 px in Akzent) per `background-image` mit 8 Linear-Gradients, `background-position` in die vier Ecken. |
| **Karte/Raster-Fläche** | Hintergrund mit 24-px-Gitter aus Cyan-Linien (5 %), Innenglow, Cyan-Rand 40 %. |
| **Zellen** | offen = Akzent 32 % + `drop-shadow` Akzent; fertig = Grün 40 % + Glow; Hover = Cyan 50 % + Cyan-Glow. |
| **Meldungen** | linker 3-px-Rand (Cyan normal, Grün fertig, Rot Problem). Problem-Meldungen bekommen oben einen **Hazard-Streifen** (4 px, `repeating-linear-gradient(-45deg,#fcee09 0 6px,#111 6px 12px)`). |
| **Segment-Balken** | Reihe schräger Mini-Balken (`skewX(-18deg)`, 4–6×12 px), aktive in Akzent mit Glow, vollständige in Grün; Einblend-Animation. |
| **Toast (Hologramm)** | dunkles Türkis, 4-px-Akzentrand links, Kopfzeile `// EINGEHENDE MELDUNG` (9 px, Cyan, weit gesperrt), schiebt von rechts rein, Text tippt sich zeichenweise mit blockförmigem Cursor `█` ein. |
| **Statusleiste** | feste Leiste unten, 24 px, Mono 11 px, Cyan-Oberkante; grün „ONLINE“, rot „OFFLINE“. |
| **HUD-Ecken** | vier 16-px-Eckwinkel in Akzent über der Hauptfläche + Scan-Linie (36 px hoher Verlauf, läuft in 6 s von oben nach unten). |

## 3. Interaktionseffekte

- **Knopf-Hover:** Lichtstreifen (`::before`, weiß, `skewX(-20deg)`) wandert in 0,55 s durch; Rand/Schrift werden Akzent, Innenglow + 2 px Unterkante; kurzer Glitch (`translate` ±3 px, rot/cyan `drop-shadow`) und horizontale farbige Schnitte als Überlagerung (`::after`, `mix-blend-mode:difference`, `clip-path: inset()` animiert). **Wichtig:** Glitch nie per `clip-path`-Animation am Knopf selbst, sonst ist er kurz nicht klickbar – immer als Overlay.
- **Klick:** Knopf `scale(.97)` + heller; Ripple-Kreis an der Klickstelle (Radial-Gradient weiß→Akzent, wächst auf Faktor 18 in .55 s).
- **Hauptknopf:** Akzent-Füllung, schwarze Schrift; OK-Knopf grün; Warn-Knopf rot umrandet.
- **Rot-Alarm (Zustand „Problem offen“):** `body.cp-alert` überschreibt `--accent`/`--cyan` mit Rot-Tönen → die **ganze Seite wird rot**. Dazu roter Innenrahmen (`body::before` inset-Shadow 120 px), pulsierender Kopf-Schatten, Warnband oben (rote Streifen `#ff2a55/#8a0f2a`, Orbitron 900, `PROBLEM`), Hazard-Streifen an Meldungen.
- **Sonar/Druckwelle:** bei neuem Erfolg expandieren SVG-Ringe (`scale 1→7`, Strichstärke 3→.5, Opazität →0, 1,6 s), grün bei OK, rot bei Problem.
- **Glitch beim Ansichtswechsel:** Klasse `cp-glitch` (.45 s): Versatz ±4 px, rot/cyan Farbsäume, kurzes Flackern.
- **Zähler:** Zahlen zählen beim Laden hoch.
- **Scramble-Text:** neue Meldungen/Titel „entschlüsseln“ sich aus Zufallszeichen.
- **Scanner:** Cyan-Strahl (2 px, Glow) läuft zum gewählten Objekt, Ring pulsiert, Linie zieht zum Hologramm-Label (eckig, Cyan-Rand, Akzent-Werte).
- **Kreismenü (Quickhack):** Rechtsklick/langes Tippen → gestrichelter, rotierender Cyan-Kreis, vier trapezförmige Optionen (Akzent/Grün/Cyan/Violett `#c06bff`) springen mit Overshoot (`cubic-bezier(.2,1.4,.4,1)`) heraus.
- **UI-Töne:** kurze synthetische Töne (Web Audio) für Hover, Klick, Bestätigen, Fehler; schaltbar.
- **Linseneffekt:** rot/cyan Farbsäume an Hauptflächen, leichte 3D-Neigung der Seitenspalten (±2,5° mit `perspective`). Schalter.

## 4. Große Animationen

**Hacking-Boot (~3 s, bei jedem Laden, per Klick/Taste überspringbar):** Vollbild `#030409`, Matrix-Regen auf Canvas, oben/unten laufende Hazard-Streifen (14 px, scrollend), pulsierende Eckwinkel in Cyan, Terminal-Box links oben (Akzentrand, abgeschnittene Ecke, tippende Zeilen mit Blockcursor), Hex-Strom rechts (Cyan, rechtsbündig), Logo (Orbitron 900, rot/cyan Doppelschatten, periodisches Zucken mit Schnitten), unten Prozentzahl riesig (Orbitron, Glitch) und Segment-/Streifenbalken, Fußzeile mit Statusfeldern. Am Ende `ACCESS GRANTED`: alles grün, Schütteln, Bildrisse (`.bt-tear`, Streifenmuster verschiebt sich), grüner Blitz, Ausblenden mit `blur + brightness(2)`.

**Bildschirmschoner (nach 10 min Inaktivität, auch im Hintergrund-Tab; endet bei Maus/Taste/Touch):** Matrix-Regen, Hazard-Streifen oben/unten, mittig wandernde Box mit `STANDBY // KEINE AKTIVITÄT`, riesige Uhr (Orbitron, Glitch alle 7 s), Datum gesperrt in Akzent, Info-Zeile (bei Problem blinkend rot), Radar unten rechts (Konturringe + rotierender Conic-Gradient), Hinweis „BEWEGUNG ODER TASTE = AUFWACHEN“. Bei Alarm rote Box.

**Login („Breach“):** Eingabefeld mit großem Mono-Code, bei Prüfung läuft ein Raster aus Hex-Codes durch, die Zeichen des eingegebenen Codes leuchten nacheinander auf (mind. ~1,2 s); bei Erfolg grün, bei Fehler Schütteln + rot.

## 5. Farbvarianten (Presets, per JS nur `--accent/--acc-rgb/--cyan/--cy-rgb` setzen)

Gelb·Cyan (Standard) · Cyan·Magenta · Magenta·Cyan · Grün·Violett · Orange·Blau · Violett·Cyan · Rot·Gelb · Off-Rot `#ff4d3a/#ff9a8a` (Spiel-HUD) · Eierschale `#e9e2c8/#b9b196` (Upgrade-Menü). Zusätzlich freie Farbwahl. Auswahl in `localStorage` (`dekr-colors`) bzw. im Benutzerprofil.

## 6. Schalter & Barrierefreiheit

- Design an/aus (`html[data-theme="cp"]` vs. schlicht), alle Cyber-Elemente per `html:not([data-theme="cp"]) … {display:none}` ausblenden.
- **„Weniger Effekte“:** `html.fx-low *{animation:none!important;transition:none!important}`, Scan-Linie/Ringe/Boot/Screensaver aus, `clip-path` an Knöpfen entfernt.
- Auf Handy: Hex-Strom und große Boxen ausblenden, Schriften mit `clamp()`.
- Kontrast: Text `#e8f9ff` auf `#05060b`; Akzentfläche immer mit **schwarzer** Schrift.

## 7. Prompt-Kurzform für neue Projekte

> Nutze das Cyberpunk-Design aus `docs/cyberpunk-design-vorlage.md`: dunkles Interface (#05060b) mit Scanlines und Vignette, Orbitron/Rajdhani/Share Tech Mono, Akzent Gelb #fcee09 + Cyan #00f0ff, Grün #2dffb3 für OK, Rot #ff2a55 für Alarm, ohne Rundungen mit abgeschrägten Ecken (`clip-path`), Karten mit 4-px-Farbrand links, Modals mit Eck-Markierungen, Hazard-Streifen, Knopf-Hover mit Lichtstreifen + Glitch-Overlay, Ripple beim Klick, Hologramm-Toasts mit Tipp-Effekt, Hacking-Boot (~3 s, Matrix-Regen, ACCESS GRANTED), Bildschirmschoner mit Uhr und Radar nach 10 min, Rot-Alarm für die ganze Seite bei Problemen, Farb-Presets und „Weniger Effekte“-Schalter. Alles über CSS-Variablen, ohne Build-Schritt.
