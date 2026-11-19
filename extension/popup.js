function $(id) { return document.getElementById(id); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function stamp(t) { var d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

async function draw() {
  var d = await chrome.storage.local.get(['cfg', 'url', 'on', 'mins', 'last', 'hist', 'busyAt']);
  var on = d.on !== false, busy = d.busyAt && Date.now() - d.busyAt < 5 * 60000;
  $('mins').value = String(d.mins || 60);
  $('toggle').textContent = on ? 'Pause' : 'Weiter';
  $('state').textContent = !d.cfg || !d.url ? 'Noch nicht eingerichtet' : busy ? 'Liest gerade …' : on ? 'Läuft' : 'Pausiert';
  var al = await chrome.alarms.get('mipp');
  $('next').textContent = on && al ? 'Nächster Import ca. ' + stamp(al.scheduledTime) : '';
  var last = d.last;
  $('last').className = 'last' + (last ? (last.ok ? ' ok' : ' bad') : '');
  $('last').textContent = last ? stamp(last.t) + (last.ok ? ' ✔ ' : ' ✖ ') + last.text : 'Noch kein Import.';
  $('hist').innerHTML = (d.hist || []).map(function (h) { return '<div class="' + (h.ok ? 'ok' : 'bad') + '">' + esc(stamp(h.t)) + (h.ok ? ' ✔ ' : ' ✖ ') + esc(h.text) + '</div>'; }).join('') || 'Leer.';
  $('now').disabled = !!busy;
  if (!$('cfg').value && d.cfg) $('cfg').placeholder = 'Gespeichert (Zugang vorhanden)';
  if (!$('url').value && d.url) $('url').value = d.url;
  if (!d.cfg || !d.url) $('setup').open = true;
}

$('now').onclick = async function () { this.disabled = true; $('state').textContent = 'Liest gerade …'; await chrome.runtime.sendMessage({ cmd: 'run' }); draw(); };
$('toggle').onclick = async function () {
  var d = await chrome.storage.local.get(['on']);
  await chrome.storage.local.set({ on: d.on === false });
  await chrome.runtime.sendMessage({ cmd: 'alarm' }); draw();
};
$('mins').onchange = async function () { await chrome.storage.local.set({ mins: +this.value }); await chrome.runtime.sendMessage({ cmd: 'alarm' }); draw(); };
$('useTab').onclick = async function () {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0] && tabs[0].url) $('url').value = tabs[0].url;
};
$('save').onclick = async function () {
  $('msg').textContent = '';
  var o = {}, code = $('cfg').value.trim(), url = $('url').value.trim();
  if (code) {
    try { var c = JSON.parse(code); if (!c.key || !c.db || !c.refresh) throw new Error('x'); o.cfg = c; } catch (e) { $('msg').textContent = 'Der Einrichtungscode ist ungültig. Bitte vollständig von mipp.html kopieren.'; return; }
  }
  if (url) {
    var u; try { u = new URL(url); } catch (e2) { $('msg').textContent = 'Die MIPP-Adresse ist ungültig.'; return; }
    var origin = u.origin + '/*';
    var has = await chrome.permissions.contains({ origins: [origin] });
    if (!has) {
      var ok = await chrome.permissions.request({ origins: [origin] });
      if (!ok) { $('msg').textContent = 'Ohne Zugriff auf ' + u.origin + ' kann die Seite nicht gelesen werden.'; return; }
    }
    o.url = url;
  }
  await chrome.storage.local.set(o);
  await chrome.runtime.sendMessage({ cmd: 'alarm' });
  $('cfg').value = ''; $('msg').textContent = 'Gespeichert.'; draw();
};
draw();
setInterval(draw, 4000);
