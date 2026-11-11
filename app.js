(function () {
  "use strict";

  var DATA = window.ROMA_DATA;
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

  var viewToday = document.getElementById("view-today");
  var viewNenpyo = document.getElementById("view-nenpyo");
  var tabToday = document.getElementById("tab-today");
  var tabNenpyo = document.getElementById("tab-nenpyo");

  /* ---------- 画面の切り替え ---------- */
  function show(name) {
    var isToday = name !== "nenpyo";
    viewToday.hidden = !isToday;
    viewNenpyo.hidden = isToday;
    tabToday.setAttribute("aria-selected", String(isToday));
    tabNenpyo.setAttribute("aria-selected", String(!isToday));
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

  /* ---------- 解説の1件 ---------- */
  function noteFor(e) {
    var box = el("div", "note");
    var head = el("div", "note__head");
    head.appendChild(el("span", "note__year", fmtYear(e)));
    head.appendChild(el("span", "note__title", e.t));
    if (e.legend) head.appendChild(el("span", "chip", "伝承"));
    if (e.kind === "world") head.appendChild(el("span", "chip chip--world", e.region));
    box.appendChild(head);
    box.appendChild(el("p", "note__desc", e.d));
    var link = el("button", "note__link", "年表で前後を見る");
    link.type = "button";
    link.addEventListener("click", function () { openInTimeline(e.id); });
    box.appendChild(link);
    markSeen(e.id);
    return box;
  }

  /* ---------- 今日の三問 ---------- */
  var session = null;

  function startSession(isDaily) {
    var seed = isDaily ? dayKey(new Date()) : "practice-" + Date.now() + "-" + Math.random();
    session = { qs: makeSet(seed), i: 0, score: 0, isDaily: isDaily };
    renderQuestion();
  }

  var KIND = { first: "どちらが先？", world: "その頃、世界では", order: "古い順に並べる" };

  function renderQuestion() {
    var q = session.qs[session.i];
    clear(viewToday);

    var prog = el("div", "progress");
    var num = el("span", "progress__num", toRoman(session.i + 1) + " / " + toRoman(session.qs.length));
    num.setAttribute("aria-label", (session.i + 1) + "問目、全" + session.qs.length + "問");
    prog.appendChild(num);
    prog.appendChild(el("span", "", session.isDaily ? "今日の三問" : "練習"));
    viewToday.appendChild(prog);

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
        var meta = el("span", "opt__meta", fmtYear(q.options[idx]));
        b.querySelector(".opt__body").appendChild(meta);
      });
      var notes = q.type === "world" ? [q.subject, byId[q.answer]] : q.options.slice().sort(function (a, b) { return a.y - b.y; });
      finish(box, right, notes);
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

    var check = el("button", "btn", "答え合わせ");
    check.type = "button";
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

    check.addEventListener("click", function () {
      var right = chosen.every(function (id, i) { return id === q.answer[i]; });
      buttons.forEach(function (b, idx) {
        b.disabled = true;
        var id = q.options[idx].id;
        b.classList.remove("is-picked");
        b.classList.add(chosen.indexOf(id) === q.answer.indexOf(id) ? "is-right" : "is-wrong");
        b.querySelector(".opt__body").appendChild(el("span", "opt__meta", fmtYear(q.options[idx])));
      });
      row.hidden = true;
      finish(box, right, q.answer.map(function (id) { return byId[id]; }));
    });
  }

  function finish(box, right, notes) {
    if (right) session.score++;
    var v = el("p", "verdict " + (right ? "is-right" : "is-wrong"), right ? "正解" : "不正解");
    v.setAttribute("role", "status");
    box.appendChild(v);

    var ex = el("div", "explain");
    notes.forEach(function (e) { ex.appendChild(noteFor(e)); });
    box.appendChild(ex);

    var last = session.i === session.qs.length - 1;
    var next = el("button", "btn", last ? "結果を見る" : "次の問題へ");
    next.type = "button";
    next.addEventListener("click", function () {
      if (last) { completeSession(); } else { session.i++; renderQuestion(); window.scrollTo(0, 0); }
    });
    var row = el("div", "btn-row");
    row.appendChild(next);
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
    }
    renderResult(session.score, session.qs.length, session.isDaily);
    window.scrollTo(0, 0);
  }

  function renderResult(score, total, isDaily) {
    clear(viewToday);
    var box = el("div", "result");
    box.appendChild(el("p", "q__kind", isDaily ? "今日の三問の結果" : "練習の結果"));
    var s = el("p", "result__score", toRoman(score) + " / " + toRoman(total));
    s.appendChild(el("small", "", total + "問中 " + score + "問正解"));
    box.appendChild(s);

    var seenCount = roman.filter(function (e) { return state.seen[e.id]; }).length;
    var line = (state.streak > 0 ? state.streak + "日連続。" : "") +
      "ローマ史 " + roman.length + "件のうち " + seenCount + "件の解説を読んだ。";
    box.appendChild(el("p", "result__streak", line));
    if (isDaily) box.appendChild(el("p", "q__hint", "今日の三問は1日1回。明日、新しい3問に変わる。"));

    var row = el("div", "btn-row");
    var again = el("button", "btn", "練習でもう3問");
    again.type = "button";
    again.addEventListener("click", function () { startSession(false); });
    var tl = el("button", "btn btn--ghost", "年表を見る");
    tl.type = "button";
    tl.addEventListener("click", function () { go("nenpyo"); });
    row.appendChild(again);
    row.appendChild(tl);
    box.appendChild(row);
    viewToday.appendChild(box);
  }

  /* ---------- 年表 ---------- */
  var seenLabel = null;

  function markSeen(id) {
    if (state.seen[id]) return;
    state.seen[id] = true;
    save();
    var li = document.getElementById("ev-" + id);
    if (li) li.classList.add("is-seen");
    updateSeenLabel();
  }
  function updateSeenLabel() {
    if (!seenLabel) return;
    var n = roman.filter(function (e) { return state.seen[e.id]; }).length;
    seenLabel.textContent = "ローマ史 " + roman.length + "件中 " + n + "件を読んだ";
  }

  function renderTimeline() {
    clear(viewNenpyo);

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
    });
  }

  function eventItem(e) {
    var li = el("li", "ev" + (e.kind === "world" ? " ev--world" : ""));
    li.id = "ev-" + e.id;
    if (state.seen[e.id]) li.classList.add("is-seen");

    var d = el("details");
    var s = el("summary");
    s.appendChild(el("span", "ev__year", fmtYear(e)));
    var title = el("span", "ev__title", e.t + " ");
    if (e.legend) title.appendChild(el("span", "chip", "伝承"));
    if (e.kind === "world") title.appendChild(el("span", "chip chip--world", e.region));
    s.appendChild(title);
    d.appendChild(s);

    var body = el("div", "ev__body");
    body.appendChild(el("p", "", e.d));
    if (e.place) body.appendChild(el("p", "ev__place", "いま見られる場所：" + e.place));
    if (e.kind === "roman") {
      var a = el("p", "ev__auc", "ローマ建国紀元 ");
      a.appendChild(el("span", "", toRoman(auc(e.y))));
      a.appendChild(document.createTextNode("（" + auc(e.y) + "）年"));
      body.appendChild(a);
    }
    d.appendChild(body);
    d.addEventListener("toggle", function () { if (d.open) markSeen(e.id); });
    li.appendChild(d);
    return li;
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
    li.classList.add("is-flash");
    setTimeout(function () { li.classList.remove("is-flash"); }, 1600);
    li.scrollIntoView({ block: "center" });
  }

  /* ---------- 起動 ---------- */
  var thisYear = new Date().getFullYear();
  document.getElementById("auc-today").textContent =
    "ANNO " + toRoman(auc(thisYear)) + " AB VRBE CONDITA";
  document.getElementById("auc-today").setAttribute("aria-label", "ローマ建国紀元 " + auc(thisYear) + "年");

  renderTimeline();
  if (state.dailyDone === dayKey(new Date())) {
    renderResult(state.dailyScore || 0, 3, true);
  } else {
    startSession(true);
  }
  show(location.hash.slice(1) || "today");
})();
