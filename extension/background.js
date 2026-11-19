// Hintergrund: in festen Abständen die MIPP-Liste in einem eigenen Tab öffnen, 10 s warten, auslesen, importieren, Tab schließen.
importScripts('lib.js');

var WAIT_MS = 10000, LOAD_TIMEOUT = 90000, KEEP = 12;

function get(keys) { return chrome.storage.local.get(keys); }
function set(o) { return chrome.storage.local.set(o); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function stamp(t) { var d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

// Läuft im MIPP-Tab (muss eigenständig sein): wartet, liest die Tabelle und den Seitentext als Zeilenlisten
function readPage(waitMs) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      function split(t, arr) { String(t).split(/\r?\n|\t/).forEach(function (x) { x = x.trim(); if (x) arr.push(x); }); }
      function flagCode(e) {
        var v = (e.getAttribute('alt') || e.getAttribute('title') || e.getAttribute('aria-label') || '').trim();
        if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
        var m = /(?:^|[\s_-])(?:flag|fi|flag-icon|country)[-_]([a-z]{2})(?:\s|$)/i.exec(String(e.getAttribute('class') || ''));
        return m ? m[1].toUpperCase() : '';
      }
      function cellLines(c, arr) {
        var t = String(c.innerText || c.textContent || '').trim(), flags = [];
        [].forEach.call(c.querySelectorAll('img,svg,span,i,div,[title],[aria-label]'), function (e) { var f = flagCode(e); if (f && t.indexOf(f) < 0 && flags.indexOf(f) < 0) flags.push(f); });
        flags.forEach(function (f) { arr.push(f); });
        split(t, arr);
      }
      var cs = [], best = null, n = 0, cells = [];
      [].forEach.call(document.querySelectorAll('table'), function (t) { var c = t.querySelectorAll('tr').length; if (c > n) { n = c; best = t; } });
      if (best) { [].forEach.call(best.querySelectorAll('tr'), function (r) { [].forEach.call(r.children, function (c) { cellLines(c, cells); }); }); cs.push(cells); }
      var arr = [], tw = document.createTreeWalker(document.body, 5, null, false), nd, pe, st, al;
      while ((nd = tw.nextNode())) {
        if (nd.nodeType === 3) {
          pe = nd.parentElement;
          if (!pe || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName)) continue;
          st = getComputedStyle(pe);
          if (st.display === 'none' || st.visibility === 'hidden') continue;
          split(nd.nodeValue, arr);
        } else if (nd.tagName === 'IMG') {
          al = (nd.getAttribute('alt') || nd.getAttribute('title') || '').trim();
          if (al) arr.push(al);
        }
      }
      cs.push(arr);
      resolve({ cands: cs, title: document.title, url: location.href });
    }, waitMs);
  });
}

function waitLoaded(tabId) {
  return new Promise(function (resolve, reject) {
    var done = false;
    function fin(err) { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(on); clearTimeout(to); err ? reject(err) : resolve(); }
    function on(id, info) { if (id === tabId && info.status === 'complete') fin(); }
    var to = setTimeout(function () { fin(new Error('Zeitüberschreitung beim Laden der MIPP-Seite')); }, LOAD_TIMEOUT);
    chrome.tabs.onUpdated.addListener(on);
    chrome.tabs.get(tabId).then(function (t) { if (t.status === 'complete') fin(); }, function () { /* Tab weg */ });
  });
}

async function record(ok, text) {
  var d = await get(['hist']), h = d.hist || [];
  h.unshift({ t: Date.now(), ok: ok, text: text });
  await set({ last: { t: Date.now(), ok: ok, text: text }, hist: h.slice(0, KEEP), busyAt: 0 });
  chrome.action.setBadgeText({ text: ok ? '✔' : '✖' });
  chrome.action.setBadgeBackgroundColor({ color: ok ? '#2dffb3' : '#ff2a55' });
}

async function runOnce() {
  var d = await get(['cfg', 'url', 'busyAt']);
  if (d.busyAt && Date.now() - d.busyAt < 5 * 60000) return;
  if (!d.cfg || !d.url) { await record(false, 'Nicht eingerichtet (Einrichtungscode und MIPP-Adresse fehlen).'); return; }
  await set({ busyAt: Date.now() });
  chrome.action.setBadgeText({ text: '…' });
  chrome.action.setBadgeBackgroundColor({ color: '#fcee09' });
  var tabId = 0;
  try {
    var lib = MippLib.make(d.cfg);
    var tab = await chrome.tabs.create({ url: d.url, active: false });
    tabId = tab.id;
    await waitLoaded(tabId);
    var out = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: readPage, args: [WAIT_MS] });
    var res = out && out[0] && out[0].result;
    if (!res) throw new Error('Keine Antwort von der MIPP-Seite');
    var best = lib.pick(res.cands);
    if (!best || best.out.length < 2) throw new Error('Keine Liste gefunden. Ist die MIPP-Sitzung angemeldet? (Seite: ' + String(res.title || '').slice(0, 40) + ')');
    var p = await lib.importDirect(best.out.slice(1).map(function (l) { return l.split(';'); }));
    var s = p.st;
    await record(true, s.neu + ' neu, ' + s.moved + ' verschoben, ' + s.chg + ' geändert, ' + s.same + ' unverändert' + (s.past ? ', ' + s.past + ' Vergangenes übersprungen' : ''));
  } catch (e) {
    await record(false, String((e && e.message) || e));
  } finally {
    if (tabId) { try { await chrome.tabs.remove(tabId); } catch (e2) { /* schon zu */ } }
  }
}

async function applyAlarm() {
  var d = await get(['on', 'mins']);
  await chrome.alarms.clear('mipp');
  if (d.on !== false) {
    var m = d.mins || 60;
    chrome.alarms.create('mipp', { delayInMinutes: m, periodInMinutes: m });
  }
}

chrome.alarms.onAlarm.addListener(function (a) { if (a.name === 'mipp') runOnce(); });
chrome.runtime.onInstalled.addListener(applyAlarm);
chrome.runtime.onStartup.addListener(applyAlarm);
chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  if (!msg) return false;
  if (msg.cmd === 'run') { runOnce().then(function () { reply({ ok: true }); }); return true; }
  if (msg.cmd === 'alarm') { applyAlarm().then(function () { reply({ ok: true }); }); return true; }
  return false;
});
