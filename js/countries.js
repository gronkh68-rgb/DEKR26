// Länder: Ländercode (ISO) -> deutscher Name und Versandart-Punkt.
// Blau (hat Vorrang): Sonderziele. Gelb: Europa oder auf dem Landweg erreichbar. Rot: alle übrigen (Seefracht).
window.Countries = (function () {
  'use strict';
  var NAMES = ('AD Andorra|AE Vereinigte Arabische Emirate|AF Afghanistan|AG Antigua und Barbuda|AL Albanien|AM Armenien|AO Angola|AR Argentinien|AT Österreich|AU Australien|AZ Aserbaidschan|' +
    'BA Bosnien und Herzegowina|BB Barbados|BD Bangladesch|BE Belgien|BF Burkina Faso|BG Bulgarien|BH Bahrain|BI Burundi|BJ Benin|BN Brunei|BO Bolivien|BR Brasilien|BS Bahamas|BT Bhutan|BW Botsuana|BY Belarus|BZ Belize|' +
    'CA Kanada|CD DR Kongo|CF Zentralafrikanische Republik|CG Kongo|CH Schweiz|CI Elfenbeinküste|CL Chile|CM Kamerun|CN China|CO Kolumbien|CR Costa Rica|CU Kuba|CV Kap Verde|CY Zypern|CZ Tschechien|' +
    'DE Deutschland|DJ Dschibuti|DK Dänemark|DM Dominica|DO Dominikanische Republik|DZ Algerien|EC Ecuador|EE Estland|EG Ägypten|ER Eritrea|ES Spanien|ET Äthiopien|FI Finnland|FJ Fidschi|FO Färöer|FR Frankreich|' +
    'GA Gabun|GB Großbritannien|GD Grenada|GE Georgien|GG Guernsey|GH Ghana|GI Gibraltar|GL Grönland|GM Gambia|GN Guinea|GQ Äquatorialguinea|GR Griechenland|GT Guatemala|GW Guinea-Bissau|GY Guyana|' +
    'HK Hongkong|HN Honduras|HR Kroatien|HT Haiti|HU Ungarn|ID Indonesien|IE Irland|IL Israel|IM Isle of Man|IN Indien|IQ Irak|IR Iran|IS Island|IT Italien|JE Jersey|JM Jamaika|JO Jordanien|JP Japan|' +
    'KE Kenia|KG Kirgisistan|KH Kambodscha|KI Kiribati|KM Komoren|KN St. Kitts und Nevis|KP Nordkorea|KR Südkorea|KW Kuwait|KZ Kasachstan|LA Laos|LB Libanon|LC St. Lucia|LI Liechtenstein|LK Sri Lanka|LR Liberia|' +
    'LS Lesotho|LT Litauen|LU Luxemburg|LV Lettland|LY Libyen|MA Marokko|MC Monaco|MD Moldau|ME Montenegro|MG Madagaskar|MK Nordmazedonien|ML Mali|MM Myanmar|MN Mongolei|MO Macau|MR Mauretanien|MT Malta|' +
    'MU Mauritius|MV Malediven|MW Malawi|MX Mexiko|MY Malaysia|MZ Mosambik|NA Namibia|NC Neukaledonien|NE Niger|NG Nigeria|NI Nicaragua|NL Niederlande|NO Norwegen|NP Nepal|NZ Neuseeland|OM Oman|PA Panama|PE Peru|' +
    'PF Französisch-Polynesien|PG Papua-Neuguinea|PH Philippinen|PK Pakistan|PL Polen|PR Puerto Rico|PS Palästina|PT Portugal|PY Paraguay|QA Katar|RE Réunion|RO Rumänien|RS Serbien|RU Russland|RW Ruanda|' +
    'SA Saudi-Arabien|SB Salomonen|SC Seychellen|SD Sudan|SE Schweden|SG Singapur|SI Slowenien|SK Slowakei|SL Sierra Leone|SM San Marino|SN Senegal|SO Somalia|SR Suriname|SS Südsudan|ST São Tomé und Príncipe|' +
    'SV El Salvador|SY Syrien|SZ Eswatini|TD Tschad|TG Togo|TH Thailand|TJ Tadschikistan|TL Osttimor|TM Turkmenistan|TN Tunesien|TO Tonga|TR Türkei|TT Trinidad und Tobago|TW Taiwan|TZ Tansania|UA Ukraine|' +
    'UG Uganda|US USA|UY Uruguay|UZ Usbekistan|VA Vatikanstadt|VC St. Vincent und die Grenadinen|VE Venezuela|VN Vietnam|VU Vanuatu|WS Samoa|XK Kosovo|YE Jemen|ZA Südafrika|ZM Sambia|ZW Simbabwe').split('|');
  var name = {};
  NAMES.forEach(function (x) { name[x.slice(0, 2)] = x.slice(3); });
  function set(s) { var o = {}; s.split(' ').forEach(function (c) { o[c] = 1; }); return o; }
  var BLUE = set('US MX CA ZA IN EG LY');
  var YELLOW = set('AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK ' +
    'TR GE AM AZ KZ UZ TM KG TJ IR IQ SY LB IL JO SA KW QA AE OM YE PS AF PK CN MN');
  var ZONE = { blue: 'Sonderziel', yellow: 'Europa oder Landweg', red: 'Seefracht' };
  function code(c) { return String(c || '').trim().toUpperCase().slice(0, 3); }
  function nameOf(c) { c = code(c); return name[c] || c; }
  // Blau geht vor Gelb, alles andere Bekannte ist Seefracht, unbekannte Codes haben keinen Punkt
  function zone(c) {
    c = code(c);
    if (BLUE[c]) return 'blue';
    if (YELLOW[c]) return 'yellow';
    return name[c] ? 'red' : '';
  }
  function badge(c) {
    c = code(c);
    if (!c) return '';
    var z = zone(c), esc = window.Util ? Util.esc : function (x) { return x; };
    return ' <span class="badge cty" title="' + esc('Land: ' + nameOf(c) + (z ? ' · ' + ZONE[z] : '')) + '">' + (z ? '<i class="dot ' + z + '"></i>' : '') + esc(nameOf(c)) + '</span>';
  }
  return { name: nameOf, zone: zone, badge: badge };
})();
