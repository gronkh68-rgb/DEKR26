// Konfiguration. Ohne firebaseUrl läuft die Seite im LOKAL-DEMO-Modus
// (Daten nur im Browser dieses Geräts). Für Live-Betrieb mit mehreren Handys:
// Firebase Realtime Database anlegen und die URL hier eintragen (siehe README).
window.DEKR_CONFIG = {
  // Vorgabe der Podest-Auswahl am Handy (im Dashboard unter QR-Codes änderbar)
  podests: ['Podest klein', 'Podest mittel', 'Podest groß'],
  firebaseUrl: 'https://dekr26-34b05-default-rtdb.europe-west1.firebasedatabase.app'
};
