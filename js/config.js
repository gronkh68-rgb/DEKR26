// Konfiguration. Ohne firebaseUrl läuft die Seite im LOKAL-DEMO-Modus
// (Daten nur im Browser dieses Geräts). Für Live-Betrieb mit mehreren Handys:
// Firebase Realtime Database anlegen und die URL hier eintragen (siehe README).
window.DEKR_CONFIG = {
  // Vorgabe der Podest-Auswahl am Handy (im Dashboard unter QR-Codes änderbar)
  podests: ['Podest 197', 'Podest 293', 'Podest 330', 'Podest 395', 'Podest 420', 'Podest 495', 'Podest 585'],   // Zahl = Länge
  // Push-Nachricht aufs Handy bei „Beipack fertig" über den kostenlosen Dienst ntfy.sh (siehe README).
  // Leer lassen = aus. Das Thema wie ein Passwort wählen (lang, zufällig); jeder, der es kennt, sieht die Meldungen.
  ntfyTopic: 'dekr26-o2ry1ls8he5sph',
  // Geräte-Freigabe (optional): Web-API-Schlüssel des Firebase-Projekts eintragen (Projekteinstellungen > Allgemein).
  // Dann müssen neue Geräte vom Admin freigegeben werden. Einrichtung: siehe README. Leer = aus.
  authApiKey: 'AIzaSyCjjiFoHvsXMrqid-3M9zTMyXa9M1tgEqA',
  firebaseUrl: 'https://dekr26-34b05-default-rtdb.europe-west1.firebasedatabase.app'
};
