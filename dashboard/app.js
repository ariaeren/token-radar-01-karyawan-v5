// KARYAWAN token radar -- static dashboard. window.RADAR is written by main.ts; there is no fetch,
// no clock, no framework and no network. Every number shown here is from the sealed snapshot or the
// model in lib/model.ts. Hash state makes the board, the detail view and the filters linkable.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var view = document.getElementById('view');
  var state = { view: 'board', p: '', q: '', cat: 'all', chain: 'all', watch: false, growth: false, sort: 'rank', dir: 'asc' };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return money.format(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(days) {
    if (days === null || days === undefined) return 'unknown';
    return days >= 365 ? (days / 365).toFixed(1) + 'y' : Math.round(days) + 'd';
  }
  function catOf(r) { return r.category || 'Unclassified'; }
  function chainOf(r) { return r.chains && r.chains.length ? r.chains[0] : 'unknown chain'; }

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) n.appendChild(x); });
      else if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(String(c)));
      else n.appendChild(c);
    }
    return n;
  }

  function readHash() {
    var p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    var v = p.get('view');
    state.view = v === 'detail' || v === 'live' ? v : 'board';
    state.p = p.get('p') || '';
    state.q = p.get('q') || '';
    state.cat = p.get('cat') || 'all';
    state.chain = p.get('chain') || 'all';
    state.watch = p.get('watch') === '1';
    state.growth = p.get('growth') === '1';
    state.sort = p.get('sort') || 'rank';
    state.dir = p.get('dir') === 'desc' ? 'desc' : 'asc';
  }
  function go(changes) {
    Object.keys(changes).forEach(function (k) { state[k] = changes[k]; });
    var p = new URLSearchParams();
    if (state.view !== 'board') p.set('view', state.view);
    if (state.p && state.view === 'detail') p.set('p', state.p);
    if (state.q) p.set('q', state.q);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.watch) p.set('watch', '1');
    if (state.growth) p.set('growth', '1');
    if (state.sort !== 'rank') p.set('sort', state.sort);
    if (state.dir === 'desc') p.set('dir', 'desc');
    var s = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (s ? '#' + s : ''));
    render();
  }

  function byRow(a, b, field) {
    var av = a[field], bv = b[field];
    if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv));
    return (av === null ? -1 : av) - (bv === null ? -1 : bv);
  }
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (q && (r.name + ' ' + r.slug + ' ' + catOf(r) + ' ' + r.chains.join(' ')).toLowerCase().indexOf(q) < 0) return false;
      if (state.cat !== 'all' && catOf(r) !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.watch && !r.on_watchlist) return false;
      if (state.growth && !(r.change_7d !== null && r.change_7d > 0)) return false;
      return true;
    });
    var dir = state.dir === 'desc' ? -1 : 1;
    rows.sort(function (a, b) { return byRow(a, b, state.sort) * dir || a.rank - b.rank; });
    return rows;
  }
  function rowBySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }

  function chip(text) {
    var cls = 'chip';
    if (text === 'WATCHLIST') cls += ' watch';
    else if (text.indexOf('INFLOW') === 0 || text === 'SCALE $1B+' || text === 'DEEP $100M+') cls += ' flow';
    else if (text.indexOf('OUTFLOW') === 0) cls += ' cool';
    return el('span', { class: cls, text: text });
  }
  function chips(list) {
    var wrap = el('div', { class: 'chips' });
    list.forEach(function (s) { wrap.appendChild(chip(s)); });
    return wrap;
  }

  function renderHeader() {
    document.getElementById('snapshot-stamp').textContent = 'SNAPSHOT ' + DATA.as_of + ' · ' + DATA.stats.protocols + ' PROTOCOLS';
    document.getElementById('footer-note').textContent = 'Model ' + DATA.model.version + ' · formula in METHOD.md · snapshot ' + DATA.as_of;
    var biggest = DATA.rows[0];
    var tvl = DATA.rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
    var kpis = [
      ['LAUNCH CANDIDATES', String(DATA.rows.length), DATA.stats.watchlist + ' watchlist · ' + DATA.stats.below_floor + ' below floor', true],
      ['TVL ON THE RADAR', usd(tvl), 'pre-token protocols only', false],
      ['TOP IMPLIED VALUE', usd(biggest.implied_value_usd), biggest.name, false],
      ['ALREADY TRADING', String(DATA.stats.live), 'held apart from the board', true],
    ];
    var box = document.getElementById('kpis');
    box.textContent = '';
    kpis.forEach(function (k) {
      box.appendChild(el('div', { class: 'kpi' + (k[3] ? ' accent' : '') },
        el('div', { class: 'k-label', text: k[0] }),
        el('div', { class: 'k-value', text: k[1] }),
        el('div', { class: 'k-sub', text: k[2] })));
    });
    document.getElementById('hero-lede').textContent =
      DATA.stats.pre_token + ' protocols record no token. The board ranks ' + DATA.rows.length +
      ' launch candidates by a stated TVL × growth × tokenless-tenure model, and gives every row a costed farm plan. ' +
      DATA.stats.live + ' token-bearing protocols are shown as market context, never given an implied launch value.';
  }

  function optionCounts(field) {
    var counts = {};
    DATA.rows.forEach(function (r) {
      var k = field === 'cat' ? catOf(r) : (r.chains[0] || 'unknown chain');
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
  }
  function selectField(label, key, allLabel) {
    var s = el('select', { onchange: function (e) { goField(key, e.target.value); } });
    s.appendChild(el('option', { value: 'all', text: allLabel }));
    optionCounts(key).forEach(function (v) {
      var o = el('option', { value: v, text: v });
      if (state[key] === v) o.selected = true;
      s.appendChild(o);
    });
    s.value = state[key];
    return el('label', { class: 'field' }, el('span', { text: label }), s);
  }
  function goField(k, v) {
    var next = {}; next[k] = v; go(next);
  }

  function rail() {
    var box = el('aside', { class: 'panel rail' });
    box.appendChild(el('div', { class: 'rail-head' }, el('h2', { text: 'SCREEN' }), el('span', { text: 'FILTERS' })));
    var search = el('input', { type: 'search', value: state.q, placeholder: 'name, chain, category', onchange: function (e) { goField('q', e.target.value); } });
    box.appendChild(el('label', { class: 'field' }, el('span', { text: 'Search the board' }), search));
    box.appendChild(selectField('Category', 'cat', 'All categories'));
    box.appendChild(selectField('Primary chain', 'chain', 'All chains'));

    var toggles = el('div', { class: 'toggles' });
    [['watch', 'Watchlist only', String(DATA.stats.watchlist)], ['growth', 'Positive 7d only', '↑']].forEach(function (t) {
      toggles.appendChild(el('button', {
        class: 'toggle', 'aria-pressed': state[t[0]] ? 'true' : 'false',
        onclick: function () { var n = {}; n[t[0]] = !state[t[0]]; go(n); }
      }, el('span', { text: t[1] }), el('i', { text: t[2] })));
    });
    box.appendChild(toggles);
    box.appendChild(el('button', { class: 'reset', text: 'Clear all filters', onclick: function () {
      go({ q: '', cat: 'all', chain: 'all', watch: false, growth: false, sort: 'rank', dir: 'asc' });
    } }));

    var m = DATA.model;
    var formula = el('div', { class: 'formula-box' }, el('h3', { text: 'THE VALUE MODEL' }));
    formula.appendChild(el('code', { text: 'implied = tvl × ' + m.base_usd_per_tvl_usd +
      '\n× (1 + clamp(7d, ' + m.growth_floor_pct + ', ' + m.growth_cap_pct + ') / 100 × ' + m.growth_weight + ')' +
      '\n× (' + m.tenure_floor + ' + age/1095 × ' + m.tenure_span + ')' }));
    formula.appendChild(el('p', { text:
      'TVL, seven-day change and days tracked without a token are the only inputs. Unknown dates use 365 days. Growth is clipped so one noisy week cannot dominate.' }));
    box.appendChild(formula);
    return box;
  }

  function sortHeader(label, key, width) {
    var b = el('button', { text: label + (state.sort === key ? (state.dir === 'asc' ? ' ↑' : ' ↓') : ''), onclick: function () {
      go({ sort: key, dir: state.sort === key && state.dir === 'asc' ? 'desc' : 'asc' });
    } });
    if (state.sort === key) b.className = 'active';
    return el('th', { style: width ? 'width:' + width : null }, b);
  }

  function tableHead(live) {
    var tr = el('tr');
    if (live) {
      [['#', 'rank', '46px'], ['PROTOCOL', 'name', null], ['CATEGORY', 'category', '150px'],
       ['TVL', 'tvl_usd', '105px'], ['MARKET CAP', 'mcap_usd', '120px'], ['MCAP / TVL', 'mcap_to_tvl', '110px']].forEach(function (c) {
        tr.appendChild(sortHeader(c[0], c[1], c[2]));
      });
    } else {
      [['#', 'rank', '46px'], ['PROTOCOL', 'name', null], ['TVL', 'tvl_usd', '104px'],
       ['7D', 'change_7d', '88px'], ['TOKENLESS', 'age_days', '90px'],
       ['IMPLIED VALUE', 'implied_value_usd', '158px'], ['SIGNALS', null, '216px']].forEach(function (c) {
        tr.appendChild(sortHeader(c[0], c[1] || 'rank', c[2]));
      });
      tr.appendChild(el('th', { style: 'width:30px', text: '' }));
    }
    return el('thead', {}, tr);
  }

  function boardRow(r, max) {
    var tdb = el('td', {}, el('div', { class: 'rank-cell' }, el('i', {}), el('b', { text: String(r.rank).padStart(3, '0') })));
    var proto = el('td', {}, el('div', { class: 'proto' },
      el('strong', { text: r.name }), el('small', { text: catOf(r) + ' · ' + r.chains.slice(0, 2).join(', ') })));
    var tvl = el('td', { class: 'mono', text: usd(r.tvl_usd) });
    var gcls = r.change_7d === null ? 'flat' : r.change_7d >= 0 ? 'up' : 'down';
    var growth = el('td', { class: 'delta ' + gcls, text: pct(r.change_7d) });
    var ageCell = el('td', { class: 'mono', text: age(r.age_days) });
    var track = el('i', {});
    track.style.width = Math.max(4, Math.round(r.implied_value_usd / max * 100)) + '%';
    var imp = el('td', {}, el('span', { class: 'implied' }, el('b', { text: usd(r.implied_value_usd) }), el('span', { class: 'track' }, track)));
    var sig = el('td', {}, chips(r.reasons));
    var tr = el('tr', { tabindex: '0', 'data-selected': state.p === r.slug ? 'true' : 'false' },
      tdb, proto, tvl, growth, ageCell, imp, sig, el('td', { class: 'chev', text: '›' }));
    function open() { go({ view: 'detail', p: r.slug }); }
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    return tr;
  }

  function liveRow(r, i) {
    return el('tr', {},
      el('td', { class: 'rank-cell' }, el('b', { text: String(i + 1).padStart(2, '0') })),
      el('td', {}, el('div', { class: 'proto' }, el('strong', { text: r.name }), el('small', { text: r.slug + ' · ' + r.chains.slice(0, 2).join(', ') }))),
      el('td', { class: 'mono', text: catOf(r) }),
      el('td', { class: 'mono', text: usd(r.tvl_usd) }),
      el('td', { class: 'mono', text: usd(r.mcap_usd) }),
      el('td', { class: 'mono up', text: r.mcap_to_tvl.toFixed(2) + '×' }));
  }

  function renderBoard() {
    var rows = filteredRows();
    var main = el('section', { class: 'panel main' });
    var toolbar = el('div', { class: 'toolbar' });
    [['board', 'Ranked board', false], ['live', 'Live tokens ' + DATA.stats.live, true]].forEach(function (t) {
      toolbar.appendChild(el('button', {
        class: 'tab' + (t[2] ? ' ghost' : ''), 'aria-pressed': state.view === t[0] ? 'true' : 'false',
        onclick: function () { go({ view: t[0], p: '' }); }
      }, t[1]));
    });
    toolbar.appendChild(el('div', { class: 'result-count' }, el('b', { text: String(rows.length) }), ' candidates shown'));
    main.appendChild(toolbar);

    if (state.view === 'live') {
      var live = DATA.live.slice().sort(function (a, b) { return byRow(a, b, state.sort) * (state.dir === 'desc' ? -1 : 1); });
      main.appendChild(el('div', { class: 'table-scroll' }, el('table', {}, tableHead(true), el('tbody', {},
        live.map(liveRow)))));
      main.appendChild(el('div', { class: 'legend' },
        el('span', {}, el('b', { text: 'Market context only. ' }), 'These protocols already have a token, so no launch value is invented for them.')));
    } else if (rows.length === 0) {
      main.appendChild(el('div', { class: 'empty' }, el('strong', { text: 'No candidate matches those filters.' }),
        el('span', { text: 'Clear a category or the positive-growth filter to see more of the board.' })));
    } else {
      var max = DATA.rows[0].implied_value_usd;
      main.appendChild(el('div', { class: 'table-scroll' }, el('table', {}, tableHead(false),
        el('tbody', {}, rows.map(function (r) { return boardRow(r, max); })))));
      main.appendChild(el('div', { class: 'legend' },
        el('span', {}, el('b', { text: 'Click any row ' }), 'for its figures, score breakdown and six-step farm plan.'),
        el('span', {}, 'Rank = implied launch value, high to low.'),
        el('span', {}, 'Chips come from TVL, 7d change and tokenless age.')));
    }
    view.textContent = '';
    view.appendChild(el('div', { class: 'board-grid' }, rail(), main));
  }

  function metric(label, value, hi) {
    return el('div', { class: 'metric' + (hi ? ' hi' : '') }, el('span', { text: label }), el('b', { text: value }));
  }
  function line(label, value, total) {
    return el('div', { class: 'line' + (total ? ' total' : '') }, el('span', { text: label }), el('b', { text: value }));
  }

  function renderDetail(r) {
    var m = DATA.model;
    var f = r.factors;
    var base = r.tvl_usd * m.base_usd_per_tvl_usd;
    var box = el('section', {});
    box.appendChild(el('button', { class: 'back', text: '← Back to ranked board', onclick: function () { go({ view: 'board', p: '' }); } }));
    var head = el('div', { class: 'panel detail-head' },
      el('div', { class: 'detail-title' },
        el('div', { class: 'rank-seal', text: '#' + r.rank }),
        el('div', {}, el('h2', { text: r.name }),
          el('p', { text: catOf(r) + ' · ' + r.chains.join(' / ') + ' · ' + (r.on_watchlist ? 'house watchlist' : 'below-floor discovery') }))),
      el('div', { class: 'stamp' }, el('div', { text: 'SNAPSHOT ' + DATA.as_of }), el('div', { text: r.slug })));
    box.appendChild(head);

    var grid = el('div', { class: 'detail-grid' });
    var left = el('div', { class: 'panel card' });
    left.appendChild(el('h3', { text: 'The evidence' }));
    left.appendChild(el('div', { class: 'metrics' },
      metric('TVL', usd(r.tvl_usd)),
      metric('7-day TVL change', pct(r.change_7d)),
      metric('Tokenless age', age(r.age_days)),
      metric('Implied launch value', usd(r.implied_value_usd), true)));
    var eq = el('div', { class: 'equation' },
      line('TVL × base', usd(r.tvl_usd) + ' × ' + m.base_usd_per_tvl_usd + ' = ' + usd(base)),
      line('7d ' + pct(f.growth_pct) + ' → growth', '×' + f.growth_multiplier.toFixed(3)),
      line('age ' + (r.age_days === null ? 'unknown' : r.age_days + 'd') + ' → tenure', '×' + f.tenure_multiplier.toFixed(3)),
      line('Implied launch FDV', usd(r.implied_value_usd), true));
    left.appendChild(eq);
    left.appendChild(el('h3', { text: 'Why it ranks here', style: 'margin-top:16px' }));
    left.appendChild(chips(r.reasons));
    left.appendChild(el('p', { class: 'detail-note', text:
      'This protocol records no market cap, CoinGecko id or ticker in the snapshot. Its rank uses only its own TVL, its seven-day TVL change and the days it has been tracked without a token. ' +
      'The claim is an estimate of a future launch, not a signal that a launch is announced.' }));

    var near = el('div', { class: 'nearby' });
    near.appendChild(el('h3', { text: 'Nearby ranks' }));
    DATA.rows.slice(Math.max(0, r.rank - 2), Math.min(DATA.rows.length, r.rank + 1)).forEach(function (x) {
      near.appendChild(el('div', { class: 'nearby-row' },
        el('span', { text: '#' + x.rank + '  ' + x.name }), el('b', { text: usd(x.implied_value_usd) })));
    });
    left.appendChild(near);

    var right = el('div', { class: 'panel card' });
    right.appendChild(el('h3', { text: 'Farm plan · six costed steps' }));
    var steps = el('div', { class: 'plan-list' });
    r.farm_plan.forEach(function (s, i) {
      steps.appendChild(el('div', { class: 'step' },
        el('div', { class: 'step-n', text: String(i + 1) }),
        el('div', {}, el('b', { text: s.title }), el('p', { text: s.detail }),
          el('div', { class: 'meta' }, el('span', { text: 'COST ' + s.cost }), el('span', { text: 'TIME ' + s.time })))));
    });
    right.appendChild(steps);
    grid.appendChild(left);
    grid.appendChild(right);
    box.appendChild(grid);
    view.textContent = '';
    view.appendChild(box);
  }

  function render() {
    readHash();
    renderHeader();
    if (state.view === 'detail') {
      var r = rowBySlug(state.p) || DATA.rows[0];
      renderDetail(r);
    } else {
      renderBoard();
    }
  }
  window.addEventListener('hashchange', render);
  render();
}());
