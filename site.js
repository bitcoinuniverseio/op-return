/* Progressive enhancement only: theme toggle, heading anchors, client-side
   search. Every page reads correctly with this file blocked or disabled. */
(function () {
  'use strict';

  /* ---------- theme ---------- */

  var root = document.documentElement;
  var KEY = 'op-return-theme';

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private mode */ }
  }
  function apply(value) {
    if (value === 'light' || value === 'dark') root.setAttribute('data-theme', value);
    else root.removeAttribute('data-theme');
  }
  function current() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  apply(stored());

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.hidden = false;
    var label = function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      toggle.textContent = current() === 'dark' ? 'light' : 'dark';
      toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    };
    label();
    toggle.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      store(next);
      label();
    });
  }

  /* ---------- heading anchors ---------- */

  var headings = document.querySelectorAll('main h2[id], main h3[id]');
  Array.prototype.forEach.call(headings, function (h) {
    var a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-label', 'Permalink to this section');
    h.appendChild(a);
  });

  /* ---------- search ---------- */

  var input = document.getElementById('site-search');
  var list = document.getElementById('search-results');
  if (!input || !list) return;

  var index = null;
  var loading = false;
  var base = input.getAttribute('data-base') || '';

  function load() {
    if (index || loading) return Promise.resolve(index);
    loading = true;
    return fetch(base + 'search-index.json', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { index = Array.isArray(data) ? data : []; loading = false; return index; })
      .catch(function () { index = []; loading = false; return index; });
  }

  function score(entry, terms) {
    var hay = (entry.title + ' ' + entry.heading + ' ' + entry.text + ' ' + (entry.aliases || []).join(' ')).toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (hay.indexOf(t) < 0) return 0;
      total += 1;
      if ((entry.heading || '').toLowerCase().indexOf(t) >= 0) total += 3;
      if ((entry.aliases || []).join(' ').toLowerCase().indexOf(t) >= 0) total += 2;
    }
    return total;
  }

  function render(matches, query) {
    list.innerHTML = '';
    if (!query) return;
    if (!matches.length) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.className = 'empty';
      span.textContent = 'No match for "' + query + '". Try op-20, opns, nulldata, datacarrier, prunable, or a rule id such as R-20-4.';
      li.appendChild(span);
      list.appendChild(li);
      return;
    }
    matches.slice(0, 12).forEach(function (m) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = base + m.url;
      var where = document.createElement('span');
      where.className = 'where';
      where.textContent = m.title;
      var head = document.createElement('strong');
      head.textContent = m.heading;
      var snip = document.createElement('span');
      snip.className = 'snip';
      snip.textContent = m.text.length > 130 ? m.text.slice(0, 130) + '...' : m.text;
      a.appendChild(where);
      a.appendChild(head);
      a.appendChild(snip);
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function run() {
    var query = input.value.trim();
    if (!query) { render([], ''); return; }
    load().then(function (data) {
      var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      var scored = [];
      for (var i = 0; i < data.length; i++) {
        var s = score(data[i], terms);
        if (s > 0) scored.push({ s: s, e: data[i] });
      }
      scored.sort(function (a, b) { return b.s - a.s; });
      render(scored.map(function (x) { return x.e; }), query);
    });
  }

  input.addEventListener('input', run);
  input.addEventListener('focus', load);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; render([], ''); input.blur(); }
    if (e.key === 'ArrowDown') {
      var first = list.querySelector('a');
      if (first) { e.preventDefault(); first.focus(); }
    }
  });
  list.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { render([], ''); input.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!input.contains(e.target) && !list.contains(e.target)) render([], '');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    input.focus();
    input.select();
  });
}());
