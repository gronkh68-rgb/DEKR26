// DEUKRO26 – Hülle für die QR-Karte (Papier/laminiert, A6-Breite)
// Flach drucken (Rückseite auf dem Druckbett). Die Karte wird von oben eingeschoben.
// Alle Maße in mm. Karte messen und unten anpassen.

card_w   = 105;     // Breite der Karte
card_h   = 140;     // Höhe der Karte (wie gedruckt, bei Bedarf messen)
card_t   = 0.6;     // Dicke der Karte (Papier 0.2, laminiert ca. 0.5-0.7)
tol      = 0.8;     // Spiel rundherum
wall     = 5;       // Rahmen außerhalb der Tasche
overlap  = 4;       // Vorderwand überlappt die Karte um so viel (hält sie fest)
back_t   = 1.6;     // Rückwand
front_t  = 1.6;     // Vorderwand
corner   = 5;       // Eckenradius außen
tab_w    = 40;      // Lasche oben für Band/Karabiner (nur Rückwand)
tab_h    = 16;
holes    = true;    // 2 Schraubenlöcher unten für Wandmontage (4 mm)

pocket_w = card_w + tol * 2;
pocket_h = card_h + tol;
pocket_t = card_t + 0.4;
out_w    = pocket_w + wall * 2;
body_h   = pocket_h + wall + overlap;
total_t  = back_t + pocket_t + front_t;

module rrect(w, h, r, t) {
    translate([r, r, 0]) linear_extrude(t)
        offset(r = r) square([w - 2 * r, h - 2 * r]);
}

difference() {
    union() {
        rrect(out_w, body_h, corner, total_t);
        // Lasche oben, nur so dick wie die Rückwand
        translate([out_w / 2 - tab_w / 2, body_h - 2, 0]) rrect(tab_w, tab_h + 2, 5, back_t);
    }
    // Tasche für die Karte, oben offen
    translate([wall, wall + overlap, back_t]) cube([pocket_w, pocket_h + 20, pocket_t]);
    // Sichtfenster vorne (rundum 'overlap' Rand, oben offen)
    translate([wall + overlap, wall + overlap, back_t + pocket_t - 0.01])
        cube([pocket_w - overlap * 2, pocket_h + 20, front_t + 1]);
    // Loch in der Lasche
    translate([out_w / 2, body_h + tab_h / 2 + 1, -1]) cylinder(d = 6, h = total_t + 2, $fn = 40);
    // Schraubenlöcher
    if (holes)
        for (x = [wall + 5, out_w - wall - 5])
            translate([x, (wall + overlap) / 2, -1]) cylinder(d = 4, h = total_t + 2, $fn = 32);
}
