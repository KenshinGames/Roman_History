(function () {
  "use strict";

  var DATA = window.ROMA_DATA;
  var MAP = window.ROMA_MAP;
  var IMG = window.ROMA_IMAGES || {};

  var roman = DATA.roman.slice().sort(function (a, b) { return a.y - b.y; });
  var world = DATA.world.slice().sort(function (a, b) { return a.y - b.y; });
  var byId = {};
  roman.forEach(function (e) { e.kind = "roman"; byId[e.id] = e; });
  world.forEach(function (e) { e.kind = "world"; byId[e.id] = e; });

  var ERAS = [
    { latin: "REGNVM", name: "王政", span: "前753年〜前509年", from: -753, to: -510 },
    { latin: "RES PVBLICA", name: "共和政", span: "前509年〜前27年", from: -509, to: -28 },
    { latin: "PRINCIPATVS", name: "元首政（帝政前期）", span: "前27年〜後284年", from: -27, to: 283 },
    { latin: "DOMINATVS", name: "専制君主政（帝政後期）", span: "後284年〜後476年", from: 284, to: 476 }
  ];

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* 既定のまま */ }

  /* ---------- 保存（この端末のブラウザだけ） ---------- */
  var KEY = "ichinichi-roma-v1";
  var state = { streak: 0, lastDay: null, seen: {}, showWorld: true, dailyDone: null, dailyScore: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === "object") {
      Object.keys(state).forEach(function (k) { if (k in saved) state[k] = saved[k]; });
    }
  } catch (e) { /* 保存が使えなくても動く */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 同上 */ }
  }

  /* ---------- 年の表記 ---------- */
  function yearLabel(y) { return y < 0 ? "前" + (-y) + "年" : "後" + y + "年"; }
  function fmtYear(e) {
    var s = e.y2 !== undefined
      ? (e.y < 0 ? "前" + (-e.y) : "後" + e.y) + "〜" + yearLabel(e.y2)
      : yearLabel(e.y);
    return s + (e.approx ? "頃" : "");
  }
  function toRoman(n) {
    if (n <= 0) return "NVLLA";
    var table = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
      [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    var out = "";
    table.forEach(function (p) { while (n >= p[0]) { out += p[1]; n -= p[0]; } });
    return out;
  }
  /* ローマ建国紀元。前753年が第1年、紀元0年は存在しない */
  function auc(y) { return y < 0 ? 754 + y : 753 + y; }

  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- 乱数（日付から毎日同じ問題を作る） ---------- */
  function rngFrom(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    var a = h >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- 問題を作る ---------- */
  function makeFirst(rnd) {
    for (var n = 0; n < 200; n++) {
      var a = pick(roman, rnd), b = pick(roman, rnd);
      var gap = Math.abs(a.y - b.y);
      if (a !== b && gap >= 20 && gap <= 250) {
        return { type: "first", options: [a, b], answer: a.y < b.y ? a.id : b.id };
      }
    }
    return { type: "first", options: [roman[0], roman[1]], answer: roman[0].id };
  }
  function makeWorld(rnd) {
    var usable = roman.filter(function (r) {
      return world.some(function (w) { return Math.abs(w.y - r.y) <= 20; }) &&
        world.filter(function (w) { return Math.abs(w.y - r.y) >= 100; }).length >= 3;
    });
    var r = pick(usable, rnd);
    var right = pick(world.filter(function (w) { return Math.abs(w.y - r.y) <= 20; }), rnd);
    var wrong = shuffle(world.filter(function (w) { return Math.abs(w.y - r.y) >= 100; }), rnd).slice(0, 3);
    return { type: "world", subject: r, options: shuffle([right].concat(wrong), rnd), answer: right.id };
  }
  function makeOrder(rnd) {
    for (var n = 0; n < 300; n++) {
      var four = shuffle(roman, rnd).slice(0, 4);
      var sorted = four.slice().sort(function (a, b) { return a.y - b.y; });
      var ok = true;
      for (var i = 1; i < 4; i++) { if (sorted[i].y - sorted[i - 1].y < 20) ok = false; }
      if (ok) return { type: "order", options: four, answer: sorted.map(function (e) { return e.id; }) };
    }
    var f = [roman[0], roman[10], roman[25], roman[45]];
    return { type: "order", options: shuffle(f, rnd), answer: f.map(function (e) { return e.id; }) };
  }
  function makeSet(seed) {
    var rnd = rngFrom(seed);
    return [makeFirst(rnd), makeWorld(rnd), makeOrder(rnd)];
  }

  /* ---------- DOM の小道具 ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function button(cls, text, onClick) {
    var b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  var viewToday = document.getElementById("view-today");
  var viewNenpyo = document.getElementById("view-nenpyo");
  var tabToday = document.getElementById("tab-today");
  var tabNenpyo = document.getElementById("tab-nenpyo");
  var streakEl = document.getElementById("streak");

  /* ---------- 絵 ---------- */
  function imgOf(e) { return IMG[e.id] || null; }
  function picture(e, thumb) {
    var m = imgOf(e);
    var im = el("img");
    im.src = "img/" + (thumb ? "t/" : "") + m.file;
    im.alt = thumb ? "" : m.cap;
    im.loading = "lazy";
    im.decoding = "async";
    if (!thumb) { im.width = m.w; im.height = m.h; }
    return im;
  }
  function plate(e) {
    var m = imgOf(e);
    var f = el("figure", "plate plate--wide");
    var im = picture(e, false);
    if (m.pos) im.style.objectPosition = m.pos;
    f.appendChild(im);
    f.appendChild(el("figcaption", "", m.cap));
    return f;
  }

  /* ---------- 地図 ---------- */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function use(id, cls) {
    var u = svg("use", { href: id });
    u.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", id);
    if (cls) u.setAttribute("class", cls);
    return u;
  }
  function mercator(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI; }
  function project(loc) {
    return [(loc[0] - MAP.lon0) * MAP.k, (mercator(MAP.latTop) - mercator(loc[1])) * MAP.k];
  }
  function stageIndex(y) {
    var i = 0;
    MAP.stages.forEach(function (s, n) { if (s.year <= y) i = n; });
    return i;
  }

  (function buildDefs() {
    var defs = document.getElementById("map-defs");
    defs.appendChild(svg("path", { id: "m-land", d: MAP.land }));
    var cp = svg("clipPath", { id: "m-clip" });
    cp.appendChild(svg("path", { d: MAP.land }));
    defs.appendChild(cp);
    defs.appendChild(svg("path", { id: "m-rivers", d: MAP.rivers }));
    MAP.stages.forEach(function (s, i) {
      var g = svg("g", { id: "m-stage-" + i });
      if (s.lost) g.appendChild(svg("path", { d: s.lost, "class": "terr terr--lost" }));
      if (s.west) g.appendChild(svg("path", { d: s.west, "class": "terr terr--west" }));
      if (s.east) g.appendChild(svg("path", { d: s.east, "class": "terr terr--east" }));
      defs.appendChild(g);
    });
  })();

  /* box = [x, y, w, h]。stages を渡すと全段階を重ねて切り替えられる */
  function makeMap(box, opts) {
    var s = svg("svg", { viewBox: box.join(" "), "class": "map", role: "img", "aria-label": opts.label || "ローマの版図の地図" });
    s.appendChild(svg("rect", { x: 0, y: 0, width: MAP.w, height: MAP.h, "class": "map__sea" }));
    s.appendChild(use("#m-land"));
    var clipped = svg("g", { "clip-path": "url(#m-clip)" });
    var layers = [];
    if (opts.all) {
      MAP.stages.forEach(function (st, i) {
        var u = use("#m-stage-" + i, "map__stage");
        layers.push(u);
        clipped.appendChild(u);
      });
    } else {
      clipped.appendChild(use("#m-stage-" + opts.stage));
    }
    s.appendChild(clipped);
    s.appendChild(use("#m-rivers"));

    var unit = box[2] / 100;                    // 画面の幅に対する大きさで印を描く
    var pin = svg("g", { "class": "pin" });
    pin.appendChild(svg("circle", { r: unit * 2.6, "class": "pin__ring" }));
    pin.appendChild(svg("circle", { r: unit * 2.6, "class": "pin__ring pin__ring--2" }));
    pin.appendChild(svg("circle", { r: unit * 0.95, "class": "pin__dot" }));
    s.appendChild(pin);

    return {
      el: s,
      setStage: function (i) { layers.forEach(function (u, n) { u.classList.toggle("is-on", n === i); }); },
      setPin: function (xy) { pin.style.transform = "translate(" + xy[0] + "px," + xy[1] + "px)"; }
    };
  }

  /* 出来事の場所を中心にした、横長の小さな地図 */
  function stripMap(e) {
    var xy = project(e.loc);
    var w = 380, h = 150;
    var x = Math.max(0, Math.min(MAP.w - w, xy[0] - w / 2));
    var y = Math.max(0, Math.min(MAP.h - h, xy[1] - h / 2));
    var m = makeMap([x, y, w, h], { stage: stageIndex(e.y), label: e.at + "の位置" });
    m.setPin(xy);
    var box = el("div", "strip");
    box.appendChild(m.el);
    box.appendChild(el("span", "strip__label", e.at));
    return box;
  }

  /* ---------- 画面の切り替え ---------- */
  function show(name) {
    var isToday = name !== "nenpyo";
    viewToday.hidden = !isToday;
    viewNenpyo.hidden = isToday;
    tabToday.setAttribute("aria-selected", String(isToday));
    tabNenpyo.setAttribute("aria-selected", String(!isToday));
    if (!isToday) syncActive();
  }
  function go(name) {
    if (location.hash !== "#" + name) {
      try { history.replaceState(null, "", "#" + name); } catch (e) { location.hash = name; }
    }
    show(name);
  }
  tabToday.addEventListener("click", function () { go("today"); });
  tabNenpyo.addEventListener("click", function () { go("nenpyo"); });
  window.addEventListener("hashchange", function () { show(location.hash.slice(1)); });

  function updateStreak() {
    var today = dayKey(new Date());
    var y = new Date(); y.setDate(y.getDate() - 1);
    var alive = state.lastDay === today || state.lastDay === dayKey(y);
    streakEl.hidden = !(alive && state.streak > 0);
    streakEl.textContent = state.streak + "日連続";
  }

  /* ---------- 読んだ記録とモザイク ---------- */
  var newlySeen = [];
  function seenCount() { return roman.filter(function (e) { return state.seen[e.id]; }).length; }
  function markSeen(id) {
    if (state.seen[id]) return;
    state.seen[id] = true;
    save();
    if (byId[id].kind === "roman") newlySeen.push(id);
    var li = document.getElementById("ev-" + id);
    if (li) li.classList.add("is-seen");
    updateSeenLabel();
  }

  function mosaic() {
    var cols = 7, rows = Math.ceil(roman.length / cols);
    var box = el("section", "mosaic");
    var head = el("div", "mosaic__head");
    head.appendChild(el("h2", "mosaic__title", "モザイクを完成させる"));
    head.appendChild(el("p", "mosaic__count", roman.length + "枚中 " + seenCount() + "枚"));
    box.appendChild(head);

    var grid = el("div", "mosaic__grid");
    grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", "解説を読んだ出来事の数だけ石がはまるモザイク。" + roman.length + "枚中 " + seenCount() + "枚");
    var art = IMG.mosaic;
    var fresh = 0;
    for (var i = 0; i < cols * rows; i++) {
      var e = roman[i];
      var t = el("div", "tile");
      var on = !e || state.seen[e.id];
      if (on) {
        t.classList.add("is-on");
        if (art) {
          t.style.backgroundImage = "url(img/" + art.file + ")";
          t.style.backgroundSize = (cols * 100) + "% " + (rows * 100) + "%";
          t.style.backgroundPosition = ((i % cols) / (cols - 1) * 100) + "% " + (Math.floor(i / cols) / (rows - 1) * 100) + "%";
        }
        if (e && newlySeen.indexOf(e.id) >= 0) {
          t.classList.add("is-new");
          t.style.animationDelay = (0.25 + fresh * 0.12) + "s";
          fresh++;
        }
      }
      grid.appendChild(t);
    }
    newlySeen = [];
    box.appendChild(grid);
    var done = seenCount() === roman.length;
    box.appendChild(el("p", "mosaic__note", done && art
      ? "完成。" + art.cap
      : "解説を1件読むごとに石が1枚はまる。" + roman.length + "枚そろうと1枚の絵になる。"));
    return box;
  }

  /* ---------- 今日の画面（始める前、終わった後） ---------- */
  var session = null;

  function renderHome() {
    clear(viewToday);
    var today = dayKey(new Date());
    var done = state.dailyDone === today;

    var withImg = roman.filter(imgOf);
    if (withImg.length) {
      var feat = pick(withImg, rngFrom("hero-" + today));
      var hero = el("figure", "hero");
      var im = picture(feat, false);
      im.loading = "eager";
      if (imgOf(feat).pos) im.style.objectPosition = imgOf(feat).pos;
      hero.appendChild(im);
      var text = el("figcaption", "hero__text");
      text.appendChild(el("p", "hero__kicker", "今日の一枚"));
      text.appendChild(el("p", "hero__title", feat.t));
      text.appendChild(el("p", "hero__meta", fmtYear(feat) + "　" + imgOf(feat).cap));
      hero.appendChild(text);
      var open = button("hero__open", "", function () { openInTimeline(feat.id); });
      open.setAttribute("aria-label", feat.t + "を年表で見る");
      hero.appendChild(open);
      viewToday.appendChild(hero);
    }

    var start = el("section", "start");
    if (done) {
      start.appendChild(el("h2", "start__title", "今日の三問は済み"));
      start.appendChild(el("p", "start__text", "3問中 " + (state.dailyScore || 0) + "問正解。明日、新しい3問に変わる。"));
      start.appendChild(button("btn btn--block", "練習でもう3問", function () { startSession(false); }));
    } else {
      start.appendChild(el("h2", "start__title", "今日の三問"));
      start.appendChild(el("p", "start__text", "3問でおよそ2分。答えるたびに、絵と地図つきの解説が出る。"));
      start.appendChild(button("btn btn--block", "はじめる", function () { startSession(true); }));
    }
    viewToday.appendChild(start);
    viewToday.appendChild(mosaic());
  }

  function startSession(isDaily) {
    var seed = isDaily ? dayKey(new Date()) : "practice-" + Date.now() + "-" + Math.random();
    session = { qs: makeSet(seed), i: 0, score: 0, marks: [], isDaily: isDaily };
    renderQuestion();
    window.scrollTo(0, 0);
  }

  var KIND = { first: "どちらが先？", world: "その頃、世界では", order: "古い順に並べる" };

  function progressBar() {
    var prog = el("div", "progress");
    var tiles = el("div", "progress__tiles");
    tiles.setAttribute("role", "img");
    tiles.setAttribute("aria-label", (session.i + 1) + "問目、全" + session.qs.length + "問");
    session.qs.forEach(function (q, n) {
      var t = el("span", "progress__tile");
      if (n < session.marks.length) t.classList.add(session.marks[n] ? "is-right" : "is-wrong");
      else if (n === session.i) t.classList.add("is-now");
      tiles.appendChild(t);
    });
    prog.appendChild(tiles);
    prog.appendChild(el("span", "", session.isDaily ? "今日の三問" : "練習"));
    return prog;
  }

  function renderQuestion() {
    var q = session.qs[session.i];
    clear(viewToday);
    viewToday.appendChild(progressBar());
    var box = el("div", "q");
    box.appendChild(el("p", "q__kind", KIND[q.type]));
    viewToday.appendChild(box);
    if (q.type === "order") renderOrder(q, box); else renderChoice(q, box);
  }

  function optionButton(e, mark, showRegion) {
    var b = el("button", "opt");
    b.type = "button";
    b.appendChild(el("span", "opt__mark", mark));
    var body = el("span", "opt__body");
    body.appendChild(el("span", "opt__title", e.t));
    if (showRegion && e.region) body.appendChild(el("span", "opt__meta", e.region));
    b.appendChild(body);
    return b;
  }

  function renderChoice(q, box) {
    box.appendChild(el("h2", "q__text", q.type === "first"
      ? "先に起きたのはどちら？"
      : "「" + q.subject.t + "」の頃、世界で起きていたのは？"));
    if (q.type === "world") box.appendChild(el("p", "q__hint", "前後20年以内の出来事を1つ選ぶ。"));

    var opts = el("div", "opts");
    var buttons = q.options.map(function (e, idx) {
      var b = optionButton(e, toRoman(idx + 1), q.type === "world");
      b.addEventListener("click", function () { answer(e.id); });
      opts.appendChild(b);
      return b;
    });
    box.appendChild(opts);

    function answer(id) {
      var right = id === q.answer;
      buttons.forEach(function (b, idx) {
        b.disabled = true;
        var oid = q.options[idx].id;
        if (oid === q.answer) b.classList.add("is-right");
        else if (oid === id) b.classList.add("is-wrong");
        b.querySelector(".opt__body").appendChild(el("span", "opt__meta", fmtYear(q.options[idx])));
      });
      var notes = q.type === "world"
        ? [q.subject, byId[q.answer]]
        : q.options.slice().sort(function (a, b) { return a.y - b.y; });
      var ex = el("div", "explain");
      notes.forEach(function (e) { ex.appendChild(card(e)); });
      finish(box, right, ex);
    }
  }

  function renderOrder(q, box) {
    box.appendChild(el("h2", "q__text", "古い順に4つ選ぶ"));
    box.appendChild(el("p", "q__hint", "選んだ順に番号が付く。もう一度押すと取り消せる。"));

    var chosen = [];
    var opts = el("div", "opts");
    var buttons = q.options.map(function (e) {
      var b = optionButton(e, "·", false);
      b.addEventListener("click", function () {
        var at = chosen.indexOf(e.id);
        if (at >= 0) chosen.splice(at, 1); else if (chosen.length < 4) chosen.push(e.id);
        paint();
      });
      opts.appendChild(b);
      return b;
    });
    box.appendChild(opts);

    var check = button("btn", "答え合わせ", function () {
      var right = chosen.every(function (id, i) { return id === q.answer[i]; });
      buttons.forEach(function (b, idx) {
        b.disabled = true;
        var id = q.options[idx].id;
        b.classList.remove("is-picked");
        b.classList.add(chosen.indexOf(id) === q.answer.indexOf(id) ? "is-right" : "is-wrong");
        b.querySelector(".opt__body").appendChild(el("span", "opt__meta", fmtYear(q.options[idx])));
      });
      row.hidden = true;
      var list = el("div", "rows");
      q.answer.forEach(function (id) { list.appendChild(compactRow(byId[id])); });
      finish(box, right, list);
    });
    check.disabled = true;
    var row = el("div", "btn-row");
    row.appendChild(check);
    box.appendChild(row);

    function paint() {
      buttons.forEach(function (b, idx) {
        var at = chosen.indexOf(q.options[idx].id);
        b.classList.toggle("is-picked", at >= 0);
        b.querySelector(".opt__mark").textContent = at >= 0 ? toRoman(at + 1) : "·";
        b.setAttribute("aria-pressed", String(at >= 0));
      });
      check.disabled = chosen.length !== 4;
    }
  }

  /* 解説：絵、説明、場所の地図 */
  function card(e) {
    var box = el("article", "card");
    if (imgOf(e)) box.appendChild(plate(e));
    var head = el("div", "card__head");
    head.appendChild(el("span", "card__year", fmtYear(e)));
    head.appendChild(el("span", "card__title", e.t));
    if (e.legend) head.appendChild(el("span", "chip", "伝承"));
    if (e.kind === "world") head.appendChild(el("span", "chip chip--world", e.region));
    box.appendChild(head);
    box.appendChild(el("p", "card__desc", e.d));
    if (e.loc) box.appendChild(stripMap(e));
    box.appendChild(button("card__link", "年表で前後を見る", function () { openInTimeline(e.id); }));
    markSeen(e.id);
    return box;
  }
  function compactRow(e) {
    var row = el("div", "row");
    var th = el("div", "row__thumb");
    if (imgOf(e)) th.appendChild(picture(e, true)); else th.textContent = toRoman(Math.abs(e.y) % 100 || 1);
    th.setAttribute("aria-hidden", "true");
    row.appendChild(th);
    var body = el("div", "row__body");
    var head = el("div", "card__head");
    head.appendChild(el("span", "card__year", fmtYear(e)));
    head.appendChild(el("span", "card__title", e.t));
    body.appendChild(head);
    body.appendChild(el("p", "row__desc", e.d));
    body.appendChild(button("card__link", "年表で前後を見る", function () { openInTimeline(e.id); }));
    row.appendChild(body);
    markSeen(e.id);
    return row;
  }

  function finish(box, right, explanation) {
    if (right) session.score++;
    session.marks.push(right);
    var old = viewToday.querySelector(".progress");
    if (old) viewToday.replaceChild(progressBar(), old);

    var v = el("p", "verdict " + (right ? "is-right" : "is-wrong"), right ? "正解" : "不正解");
    v.setAttribute("role", "status");
    box.appendChild(v);
    box.appendChild(explanation);

    var last = session.i === session.qs.length - 1;
    var row = el("div", "btn-row");
    row.appendChild(button("btn btn--block", last ? "結果を見る" : "次の問題へ", function () {
      if (last) { completeSession(); } else { session.i++; renderQuestion(); }
      window.scrollTo(0, 0);
    }));
    box.appendChild(row);
  }

  function completeSession() {
    if (session.isDaily) {
      var today = dayKey(new Date());
      var y = new Date(); y.setDate(y.getDate() - 1);
      if (state.lastDay !== today) {
        state.streak = state.lastDay === dayKey(y) ? state.streak + 1 : 1;
        state.lastDay = today;
      }
      state.dailyDone = today;
      state.dailyScore = session.score;
      save();
      updateStreak();
    }
    renderResult(session.score, session.qs.length, session.isDaily);
  }

  function renderResult(score, total, isDaily) {
    clear(viewToday);
    var box = el("section", "result");
    box.appendChild(el("p", "q__kind", isDaily ? "今日の三問の結果" : "練習の結果"));
    var s = el("p", "result__score");
    s.setAttribute("aria-label", total + "問中 " + score + "問正解");
    (toRoman(score) + " / " + toRoman(total)).split("").forEach(function (ch, i) {
      var sp = el("span", "", ch === " " ? " " : ch);
      sp.style.animationDelay = (i * 0.07) + "s";
      s.appendChild(sp);
    });
    box.appendChild(s);
    box.appendChild(el("p", "result__plain", total + "問中 " + score + "問正解"));
    if (isDaily) box.appendChild(el("p", "result__streak", state.streak + "日連続。明日、新しい3問に変わる。"));
    viewToday.appendChild(box);

    viewToday.appendChild(mosaic());

    var row = el("div", "btn-row");
    row.appendChild(button("btn", "練習でもう3問", function () { startSession(false); }));
    row.appendChild(button("btn btn--ghost", "地図と年表を見る", function () { go("nenpyo"); window.scrollTo(0, 0); }));
    viewToday.appendChild(row);
  }

  /* ---------- 地図と年表 ---------- */
  var seenLabel = null;
  var atlas = null;       // { box, map, year, title, loc, stage, legend }
  var rows = [];          // ローマ史の行（上から順）
  var active = null;
  var shownYear = null;
  var yearTimer = null;

  function updateSeenLabel() {
    if (seenLabel) seenLabel.textContent = "ローマ史 " + roman.length + "件中 " + seenCount() + "件を読んだ";
  }

  function tweenYear(to) {
    if (yearTimer) cancelAnimationFrame(yearTimer);
    if (reduceMotion || shownYear === null) { shownYear = to; atlas.year.textContent = yearLabel(to); return; }
    var from = shownYear, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / 500);
      var v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (v === 0) v = to > from ? 1 : -1;      // 紀元0年はない
      shownYear = v;
      atlas.year.textContent = yearLabel(v);
      if (p < 1) yearTimer = requestAnimationFrame(step);
    }
    yearTimer = requestAnimationFrame(step);
  }

  function setActive(e) {
    if (!atlas || !e || active === e) return;
    if (active) document.getElementById("ev-" + active.id).classList.remove("is-active");
    active = e;
    document.getElementById("ev-" + e.id).classList.add("is-active");
    var si = stageIndex(e.y);
    var st = MAP.stages[si];
    atlas.map.setStage(si);
    atlas.map.setPin(project(e.loc));
    tweenYear(e.y);
    atlas.title.textContent = e.t;
    atlas.loc.textContent = e.at;
    atlas.stage.textContent = "版図：" + st.label;
    atlas.legend.hidden = !st.east;
  }

  function syncActive() {
    if (!atlas || viewNenpyo.hidden || !rows.length) return;
    var bottom = atlas.box.getBoundingClientRect().bottom;
    var line = bottom + 44;
    /* ページの終わりでは最後の行まで届くように、基準の線を画面の下へずらす */
    var doc = document.documentElement;
    var left = doc.scrollHeight - window.innerHeight - window.scrollY;
    if (left < 320) line += (window.innerHeight - line) * (1 - Math.max(0, left) / 320);
    var best = rows[0];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].li.getBoundingClientRect().top <= line) best = rows[i]; else break;
    }
    setActive(best.e);
  }
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; syncActive(); });
  }, { passive: true });
  window.addEventListener("resize", syncActive);

  function renderTimeline() {
    clear(viewNenpyo);
    rows = [];

    var box = el("div", "atlas");
    var frame = el("div", "atlas__frame");
    var map = makeMap([0, 30, MAP.w, MAP.h - 40], { all: true, label: "ローマの版図の移り変わり" });
    frame.appendChild(map.el);
    var now = el("div", "atlas__now");
    var year = el("span", "atlas__year");
    var title = el("span", "atlas__title");
    now.appendChild(year);
    now.appendChild(title);
    frame.appendChild(now);
    box.appendChild(frame);
    var cap = el("p", "atlas__cap");
    var loc = el("span", "atlas__loc");
    var right = el("span", "");
    var stage = el("span", "");
    var legend = el("span", "atlas__legend");
    legend.appendChild(el("span", "key", "西"));
    legend.appendChild(el("span", "key key--east", "東"));
    legend.hidden = true;
    right.appendChild(stage);
    right.appendChild(document.createTextNode(" "));
    right.appendChild(legend);
    cap.appendChild(loc);
    cap.appendChild(right);
    box.appendChild(cap);
    viewNenpyo.appendChild(box);
    atlas = { box: box, map: map, year: year, title: title, loc: loc, stage: stage, legend: legend };

    var tools = el("div", "tl-tools");
    var label = el("label");
    var cb = el("input");
    cb.type = "checkbox";
    cb.id = "toggle-world";
    cb.checked = state.showWorld !== false;
    label.appendChild(cb);
    label.appendChild(document.createTextNode("同じ頃の世界も並べる"));
    tools.appendChild(label);
    seenLabel = el("span");
    tools.appendChild(seenLabel);
    viewNenpyo.appendChild(tools);
    updateSeenLabel();

    var roads = [];
    ERAS.forEach(function (era) {
      var sec = el("section", "era");
      var head = el("div", "era__head");
      head.appendChild(el("h2", "era__latin", era.latin));
      head.appendChild(el("p", "era__name", era.name + "　" + era.span));
      sec.appendChild(head);

      var ul = el("ul", "road");
      if (!cb.checked) ul.classList.add("hide-world");
      roads.push(ul);
      var lo = era === ERAS[0] ? -Infinity : era.from;
      var hi = era === ERAS[ERAS.length - 1] ? Infinity : era.to;
      roman.concat(world)
        .filter(function (e) { return e.y >= lo && e.y <= hi; })
        .sort(function (a, b) { return a.y - b.y || (a.kind === "roman" ? -1 : 1); })
        .forEach(function (e) { ul.appendChild(eventItem(e)); });
      sec.appendChild(ul);
      viewNenpyo.appendChild(sec);
    });

    cb.addEventListener("change", function () {
      roads.forEach(function (ul) { ul.classList.toggle("hide-world", !cb.checked); });
      state.showWorld = cb.checked;
      save();
      syncActive();
    });

    viewNenpyo.appendChild(credits());
    setActive(roman[0]);
  }

  function eventItem(e) {
    var li = el("li", "ev" + (e.kind === "world" ? " ev--world" : ""));
    li.id = "ev-" + e.id;
    if (state.seen[e.id]) li.classList.add("is-seen");
    if (e.kind === "roman") rows.push({ li: li, e: e });

    var d = el("details");
    var s = el("summary");
    s.appendChild(el("span", "ev__year", fmtYear(e)));
    var title = el("span", "ev__title", e.t + " ");
    if (e.legend) title.appendChild(el("span", "chip", "伝承"));
    if (e.kind === "world") title.appendChild(el("span", "chip chip--world", e.region));
    s.appendChild(title);
    if (imgOf(e)) {
      var th = picture(e, true);
      th.className = "ev__thumb";
      th.width = 56; th.height = 42;
      s.appendChild(th);
    }
    d.appendChild(s);

    var body = el("div", "ev__body");
    var filled = false;
    d.addEventListener("toggle", function () {
      if (!d.open) return;
      if (!filled) {                       // 開いたときに初めて中身を作る（絵の読み込みを遅らせる）
        filled = true;
        if (imgOf(e)) body.appendChild(plate(e));
        body.appendChild(el("p", "", e.d));
        if (e.place) body.appendChild(el("p", "ev__place", "いま見られる場所：" + e.place));
        if (e.kind === "roman") {
          var a = el("p", "ev__auc", "ローマ建国紀元 ");
          a.appendChild(el("span", "", toRoman(auc(e.y))));
          a.appendChild(document.createTextNode("（" + auc(e.y) + "）年"));
          body.appendChild(a);
        }
      }
      markSeen(e.id);
      if (e.kind === "roman") setActive(e);
    });
    d.appendChild(body);
    li.appendChild(d);
    return li;
  }

  function credits() {
    var d = el("details", "credits");
    d.appendChild(el("summary", "", "絵と地図の出典"));
    var ul = el("ul");
    Object.keys(IMG).forEach(function (k) {
      var m = IMG[k];
      var li = el("li");
      li.appendChild(document.createTextNode(m.cap + "（" + m.credit + "、" + m.license + "）"));
      if (m.src) {
        li.appendChild(document.createTextNode(" "));
        var a = el("a", "", "Wikimedia Commons");
        a.href = m.src;
        a.target = "_blank";
        a.rel = "noopener";
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    ul.appendChild(el("li", "", "絵と写真は Wikimedia Commons のものを縮小し、枠に合わせて切り抜いて表示している。"));
    ul.appendChild(el("li", "", "地図の陸地の形：Natural Earth（パブリックドメイン）。版図は概略。"));
    d.appendChild(ul);
    return d;
  }

  function openInTimeline(id) {
    go("nenpyo");
    var li = document.getElementById("ev-" + id);
    if (!li) return;
    if (li.classList.contains("ev--world")) {
      var cb = document.getElementById("toggle-world");
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change")); }
    }
    li.querySelector("details").open = true;
    var top = li.getBoundingClientRect().top + window.scrollY - atlas.box.offsetHeight - 24;
    window.scrollTo(0, Math.max(0, top));
    if (byId[id].kind === "roman") setActive(byId[id]);
  }

  /* ---------- 起動 ---------- */
  var thisYear = new Date().getFullYear();
  var aucEl = document.getElementById("auc-today");
  aucEl.textContent = "ANNO " + toRoman(auc(thisYear)) + " AB VRBE CONDITA";
  aucEl.setAttribute("aria-label", "ローマ建国紀元 " + auc(thisYear) + "年");

  updateStreak();
  renderTimeline();
  renderHome();
  show(location.hash.slice(1) || "today");
})();
