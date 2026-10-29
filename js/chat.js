// Messenger wie ein Chat-Programm: Chatliste, Verlauf mit Blasen, ungelesen-Zähler, Lesehäkchen.
// Nachrichten haben type 'chat': { from: 'dash' | QR-ID, to: 'dash' | 'all' | QR-ID, by, text, t, reads: { <Leser>: { by, t } } }.
// Das Dashboard hat die Kennung 'dash', jedes Handy die ID seines QR-Codes.
window.Chat = (function () {
  'use strict';
  var MAXAGE = 14 * 864e5;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  function peerOf(m, me) {
    if (m.to === 'all') return 'all';
    return m.from === me ? m.to : m.from;
  }
  // Nachrichten, die mich betreffen (gesendet oder empfangen), älteste zuerst
  function mineList(state, me) {
    var now = Date.now();
    return Object.keys(state.msgs).map(function (id) { return Object.assign({ id: id }, state.msgs[id]); }).filter(function (m) {
      if (m.type !== 'chat' || now - m.t > MAXAGE) return false;
      return m.from === me || m.to === me || m.to === 'all';
    }).sort(function (a, b) { return a.t - b.t; });
  }
  // Eingehend und noch nicht von mir gelesen
  function isIncoming(m, me) { return m.from !== me && (m.to === me || (m.to === 'all' && me !== 'dash')); }
  function isUnread(m, me) { return isIncoming(m, me) && !(m.reads && m.reads[me]); }
  function unreadCount(state, me) {
    return mineList(state, me).filter(function (m) { return isUnread(m, me); }).length;
  }
  // Neue eingehende Nachrichten seit dem letzten Aufruf (beim ersten Aufruf nur merken, nichts melden)
  var seenBy = {};
  function newIncoming(state, me) {
    var first = !seenBy[me], seen = seenBy[me] = seenBy[me] || {}, out = [];
    mineList(state, me).forEach(function (m) {
      if (seen[m.id]) return;
      seen[m.id] = 1;
      if (!first && isIncoming(m, me)) out.push(m);
    });
    return out;
  }

  function dayLabel(ts) {
    var d = new Date(ts), n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    var key = function (x) { return x.getFullYear() * 400 + x.getMonth() * 32 + x.getDate(); };
    if (key(d) === key(n)) return 'Heute';
    var y = new Date(n.getTime() - 864e5);
    if (key(d) === key(y)) return 'Gestern';
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  function ticks(m, me) {
    var rd = Object.keys(m.reads || {}).filter(function (k) { return k !== me; });
    var seen = m.to === 'all' ? rd.length > 0 : !!(m.reads && m.reads[m.to]);
    return '<span class="tk' + (seen ? ' seen' : '') + '" title="' + (seen ? 'gelesen' : 'gesendet') + '">' + (seen ? '✓✓' : '✓') + '</span>';
  }
  function initial(name) { return esc(String(name || '?').trim().charAt(0).toUpperCase() || '?'); }

  // cfg: { me, name(): eigener Name, contacts(state): [{ id, name, sub? }], send(text, to): Promise, read(ids): void }
  function mount(root, cfg) {
    var open = '', lastState = null, readSent = {};
    root.classList.add('chatroot');
    root.innerHTML = '<div class="chat-list"></div><div class="chat-conv" hidden>' +
      '<div class="chat-head"><button type="button" class="btn-sm chat-back" aria-label="Zurück">‹</button><span class="chat-av"></span><b class="chat-title"></b></div>' +
      '<div class="chat-msgs"></div>' +
      '<form class="chat-input"><textarea rows="1" maxlength="300" placeholder="Nachricht schreiben …" enterkeyhint="send"></textarea>' +
      '<button type="submit" class="btn-main" aria-label="Senden">➤</button></form></div>';
    var listEl = root.querySelector('.chat-list'), conv = root.querySelector('.chat-conv'),
      msgsEl = root.querySelector('.chat-msgs'), ta = root.querySelector('textarea'), form = root.querySelector('form');

    function contactsMap(state) {
      var m = {};
      cfg.contacts(state).forEach(function (c) { m[c.id] = c; });
      return m;
    }
    function renderList(state) {
      var cons = cfg.contacts(state), all = mineList(state, cfg.me), last = {}, unread = {};
      all.forEach(function (m) {
        var p = peerOf(m, cfg.me);
        last[p] = m;
        if (isUnread(m, cfg.me)) unread[p] = (unread[p] || 0) + 1;
      });
      cons.sort(function (a, b) {
        var ta = last[a.id] ? last[a.id].t : 0, tb = last[b.id] ? last[b.id].t : 0;
        return tb - ta || String(a.name).localeCompare(String(b.name));
      });
      listEl.innerHTML = cons.map(function (c) {
        var l = last[c.id], n = unread[c.id] || 0;
        var prev = l ? (l.from === cfg.me ? 'Du: ' : (c.id === 'all' ? esc(l.by) + ': ' : '')) + esc(l.text) : '<i>' + esc(c.sub || 'Chat starten') + '</i>';
        return '<button type="button" class="chat-row' + (n ? ' unread' : '') + '" data-peer="' + esc(c.id) + '"><span class="chat-av' + (c.id === 'all' ? ' grp' : '') + '">' +
          (c.id === 'all' ? '👥' : initial(c.name)) + '</span><span class="chat-mid"><b>' + esc(c.name) + '</b><small>' + prev + '</small></span>' +
          '<span class="chat-side">' + (l ? '<small>' + esc(Util.time(l.t)) + '</small>' : '') + (n ? '<span class="chat-badge">' + n + '</span>' : '') + '</span></button>';
      }).join('') || '<div class="empty">Keine Kontakte.</div>';
    }
    function renderConv(state) {
      var cm = contactsMap(state), c = cm[open];
      root.querySelector('.chat-title').textContent = c ? c.name : '';
      root.querySelector('.chat-head .chat-av').textContent = open === 'all' ? '👥' : (c ? String(c.name).trim().charAt(0).toUpperCase() : '?');
      var list = mineList(state, cfg.me).filter(function (m) { return peerOf(m, cfg.me) === open; });
      var near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 80;
      var day = '', html = '';
      list.forEach(function (m) {
        var dl = dayLabel(m.t);
        if (dl !== day) { day = dl; html += '<div class="chat-day">' + esc(dl) + '</div>'; }
        var own = m.from === cfg.me;
        html += '<div class="chat-b ' + (own ? 'own' : 'other') + '">' +
          (!own && open === 'all' ? '<small class="chat-by">' + esc(m.by) + '</small>' : '') +
          '<span class="chat-t">' + esc(m.text) + '</span>' +
          '<small class="chat-m">' + esc(Util.time(m.t)) + (own ? ' ' + ticks(m, cfg.me) : '') + '</small></div>';
      });
      msgsEl.innerHTML = html || '<div class="empty" style="margin:auto">Noch keine Nachrichten. Schreib die erste.</div>';
      if (near || !msgsEl.dataset.init) { msgsEl.scrollTop = msgsEl.scrollHeight; msgsEl.dataset.init = '1'; }
      // Geöffneten Chat als gelesen melden
      var ids = list.filter(function (m) { return isUnread(m, cfg.me) && !readSent[m.id]; }).map(function (m) { return m.id; });
      if (ids.length && document.visibilityState !== 'hidden') {
        ids.forEach(function (id) { readSent[id] = 1; });
        cfg.read(ids);
      }
    }
    function render(state) {
      lastState = state;
      if (!open) { conv.hidden = true; listEl.hidden = false; renderList(state); }
      else { listEl.hidden = true; conv.hidden = false; renderConv(state); }
    }
    function openChat(peer) {
      open = peer; msgsEl.dataset.init = '';
      render(lastState || cfg.state());
      setTimeout(function () { try { ta.focus(); } catch (e) { /* ignorieren */ } }, 50);
    }
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-peer]');
      if (b) openChat(b.dataset.peer);
    });
    root.querySelector('.chat-back').onclick = function () { open = ''; render(lastState || cfg.state()); };
    function submit() {
      var text = ta.value.trim();
      if (!text || !open) return;
      ta.disabled = true;
      cfg.send(text, open).then(function () { ta.value = ''; ta.style.height = ''; }).catch(function () { /* Meldung durch die Seite */ })
        .then(function () { ta.disabled = false; try { ta.focus(); } catch (e) { /* ignorieren */ } });
    }
    form.onsubmit = function (e) { e.preventDefault(); submit(); };
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && lastState && open) renderConv(lastState); });
    return { render: render, openChat: openChat, isOpen: function () { return open; }, close: function () { open = ''; } };
  }

  return { mount: mount, unreadCount: unreadCount, newIncoming: newIncoming, peerOf: peerOf, esc: esc };
})();
