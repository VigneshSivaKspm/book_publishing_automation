/*
 * Deterministic page builder. Runs inside the book HTML (preview iframe and
 * headless Chromium for PDF). It measures real rendered layout, so line
 * breaks, math and fonts are exactly what will print.
 *
 * Rules:
 *  - chapter-start  → new page with chapter opener header
 *  - fullpage       → own single-column page (answer key)
 *  - keep-with-next → headings never end a column
 *  - paragraphs split by words with ≥2 lines on each side (orphans/widows)
 *  - lists split between items, tables between rows (header repeated)
 *  - questions, equations, figures are never split; they move whole
 *  - two-column flow: left column top→bottom, then right column
 *  - last page of each chapter is column-balanced
 * Result: window.__PAGINATION = report (read by the PDF renderer & preflight).
 */
(function () {
  "use strict";
  var CFG = window.__BOOK_CFG;
  var MM = 96 / 25.4;
  var src = document.getElementById("src");
  var out = document.getElementById("pages");
  var wm = document.getElementById("wm-template").innerHTML;
  var report = { pages: 0, overflows: [], clipped: [], lowRes: [], katexErrors: 0, emptyPages: [], fontsOk: true, missingImages: [] };

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  var pageNo = 0;
  var page = null; // { sec, cols: [flowEl], colEls: [colEl], idx }
  var chapter = { title: "", number: "" };

  function isOdd(n) {
    return n % 2 === 1;
  }

  function makePage(kind) {
    pageNo++;
    var odd = isOdd(pageNo);
    var m = CFG.margins;
    var left = CFG.mirrored ? (odd ? m.inner : m.outer) : m.inner;
    var right = CFG.mirrored ? (odd ? m.outer : m.inner) : m.outer;
    var sec = document.createElement("section");
    sec.className = "page " + (odd ? "odd" : "even") + " kind-" + kind;
    sec.setAttribute("data-page", String(pageNo));
    var html = "";
    if (wm) html += '<div class="wm">' + wm + "</div>";
    var top = m.top;
    if (kind === "opener") {
      html +=
        '<div class="opener" style="left:' + left + "mm;right:" + right + 'mm"><div class="ct">' + esc(chapter.title) + "</div>" +
        (chapter.number ? '<div class="cb"><div class="lbl">Chapter</div><div class="num">' + esc(chapter.number) + "</div></div>" : "") +
        "</div>";
      top = 40;
    } else if (CFG.organisation || CFG.subject) {
      var org = CFG.organisation ? '<div class="org">' + esc(CFG.organisation) + "</div>" : "<div></div>";
      // Book convention (matches the references): even pages carry the subject, odd pages the chapter.
      var running = odd || !CFG.mirrored ? chapter.title || CFG.subject : CFG.subject || chapter.title;
      var subj = '<div class="subj">' + esc(running || "") + "</div>";
      // Organisation sits on the outer edge: left on even pages, right on odd pages.
      var inner = CFG.mirrored && odd ? subj + org : org + subj;
      html += '<div class="rh" style="left:' + left + "mm;right:" + right + 'mm">' + inner + "</div>";
    }
    var cols = kind === "full" ? 1 : CFG.columns;
    var bottom = m.bottom;
    html += '<div class="body" style="left:' + left + "mm;right:" + right + "mm;top:" + top + "mm;bottom:" + bottom + 'mm">';
    for (var c = 0; c < cols; c++) html += '<div class="col"><div class="flow"></div></div>';
    if (cols === 2) html += '<div class="divider"></div>';
    html += "</div>";
    if (CFG.type === "question_bank") {
      var brand = '<span class="brand">' + esc(CFG.footerText || "") + "</span>";
      var tab = '<span class="tab">' + pageNo + "</span>";
      var even = !odd;
      html += '<div class="rf qb" style="left:' + left + "mm;right:" + right + 'mm">' + (CFG.mirrored && even ? tab + brand : brand + tab) + "</div>";
    } else {
      html += '<div class="rf syl" style="left:' + left + "mm;right:" + right + 'mm"><span class="rule"></span><span class="pn">{ ' + pageNo + ' }</span><span class="rule"></span></div>';
    }
    sec.innerHTML = html;
    out.appendChild(sec);
    var colEls = Array.prototype.slice.call(sec.querySelectorAll(".col"));
    page = { sec: sec, colEls: colEls, cols: colEls.map(function (c) { return c.firstChild; }), idx: 0, kind: kind };
    return page;
  }

  function cur() {
    return page.cols[page.idx];
  }
  function capacity(i) {
    return page.colEls[i === undefined ? page.idx : i].clientHeight;
  }
  function used(flow) {
    return flow.offsetHeight;
  }
  function fits(flow) {
    return used(flow) <= flow.parentNode.clientHeight + 0.5;
  }
  function advance() {
    if (page.idx < page.cols.length - 1) page.idx++;
    else makePage("normal");
  }
  function lineHeightOf(el) {
    var lh = parseFloat(getComputedStyle(el).lineHeight);
    return isFinite(lh) ? lh : 16;
  }

  /* ---------------- splitting ---------------- */

  function tokens(p) {
    var list = [];
    Array.prototype.forEach.call(p.childNodes, function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (t) {
          if (t) list.push(document.createTextNode(t));
        });
      } else list.push(n.cloneNode(true));
    });
    return list;
  }

  function fillPara(shell, toks, k) {
    shell.innerHTML = "";
    for (var i = 0; i < k; i++) shell.appendChild(toks[i].cloneNode(true));
    // A part that ends mid-paragraph must not be justified-stretched oddly on its final line.
    return shell;
  }

  /** Split a paragraph block so the first part fills the remaining space. */
  function splitPara(block, flow) {
    var p = block.querySelector(".para");
    if (!p) return null;
    var toks = tokens(p);
    if (toks.length < 8) return null;
    var lh = lineHeightOf(p);
    var first = block.cloneNode(true);
    var fp = first.querySelector(".para");
    flow.appendChild(first);
    var lo = 1, hi = toks.length - 1, best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      fillPara(fp, toks, mid);
      if (fits(flow)) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    // Back off to a word boundary and enforce ≥2 lines on each side.
    while (best > 0 && /^\s+$/.test(toks[best - 1].textContent || "")) best--;
    fillPara(fp, toks, best);
    var firstLines = Math.round(fp.offsetHeight / lh);
    flow.removeChild(first);
    if (best === 0 || firstLines < 2) return null;
    var rest = block.cloneNode(true);
    var rp = rest.querySelector(".para");
    rp.innerHTML = "";
    for (var i = best; i < toks.length; i++) rp.appendChild(toks[i].cloneNode(true));
    rp.classList.add("cont");
    // Widow control: the carried-over part needs at least 2 lines.
    flow.appendChild(rest);
    var restLines = Math.round(rp.offsetHeight / lh);
    flow.removeChild(rest);
    if (restLines < 2) {
      // Pull one more line back: remove ~ one line of words from the first part.
      var words = Math.max(1, Math.round((best / Math.max(1, firstLines)) * 1));
      best = Math.max(0, best - words);
      if (best === 0) return null;
      fillPara(fp, toks, best);
      if (Math.round(fp.offsetHeight / lh) < 2) return null;
      rp.innerHTML = "";
      for (var j = best; j < toks.length; j++) rp.appendChild(toks[j].cloneNode(true));
    }
    first.querySelector(".para").style.textAlignLast = "justify";
    return [first, rest];
  }

  function splitChildren(block, flow, containerSel, minFirst, repeatHeader) {
    var container = block.querySelector(containerSel);
    if (!container) return null;
    var items = Array.prototype.slice.call(container.children);
    if (items.length < 2) return null;
    var first = block.cloneNode(true);
    var fc = first.querySelector(containerSel);
    fc.innerHTML = "";
    flow.appendChild(first);
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      fc.appendChild(items[i].cloneNode(true));
      if (!fits(flow)) {
        fc.removeChild(fc.lastChild);
        break;
      }
      n++;
    }
    flow.removeChild(first);
    if (n < minFirst || n >= items.length) return null;
    var rest = block.cloneNode(true);
    var rc = rest.querySelector(containerSel);
    rc.innerHTML = "";
    for (var j = n; j < items.length; j++) rc.appendChild(items[j].cloneNode(true));
    if (!repeatHeader) {
      var cap = rest.querySelector(".tcap");
      if (cap) cap.remove();
    }
    return [first, rest];
  }

  function trySplit(block, flow) {
    var kind = block.getAttribute("data-split");
    if (kind === "para") return splitPara(block, flow);
    if (kind === "list") return splitChildren(block, flow, ".list", 1, false);
    if (kind === "table") return splitChildren(block, flow, "tbody", 2, true);
    return null;
  }

  /* ---------------- placement ---------------- */

  function minNeed(block, flow) {
    // Height needed to start `block` here: whole block, or ~2 lines for splittables.
    // Measured while attached so computed styles and line heights are real.
    flow.appendChild(block);
    var h = block.offsetHeight;
    var split = block.getAttribute("data-split");
    var need = h;
    if (split === "para") {
      var p = block.querySelector(".para");
      need = Math.min(h, 2 * (p ? lineHeightOf(p) : 16) + 2);
    } else if (split === "list" || split === "table") {
      var firstItem = block.querySelector(".li, tbody tr");
      var head = block.querySelector("thead, .tcap");
      var itemH = firstItem ? firstItem.getBoundingClientRect().height : 20;
      var headH = head ? head.getBoundingClientRect().height : 0;
      need = Math.min(h, headH + itemH * (split === "table" ? 2 : 1) + 4);
    }
    flow.removeChild(block);
    return need;
  }

  function place(block, next) {
    var guard = 0;
    while (guard++ < 400) {
      var flow = cur();
      flow.appendChild(block);
      if (fits(flow)) {
        // keep-with-next: a heading must have room for the start of what follows.
        if (block.getAttribute("data-keepnext") && next && flow.children.length > 1) {
          var room = capacity() - used(flow);
          if (room < minNeed(next.cloneNode(true), flow)) {
            flow.removeChild(block);
            advance();
            continue;
          }
        }
        return;
      }
      flow.removeChild(block);
      var parts = trySplit(block, flow);
      if (parts) {
        flow.appendChild(parts[0]);
        advance();
        block = parts[1];
        continue;
      }
      if (flow.children.length === 0) {
        // Doesn't fit an empty column: shrink figures, otherwise record overflow.
        var img = block.querySelector("img");
        if (img) {
          img.style.maxHeight = capacity() * 0.9 - 30 + "px";
          flow.appendChild(block);
          if (fits(flow)) return;
          flow.removeChild(block);
        }
        flow.appendChild(block);
        report.overflows.push({ page: pageNo, node: block.getAttribute("data-node") });
        advance();
        return;
      }
      advance();
    }
  }

  /** Balance the two columns of the current page (used at chapter end). */
  function balance() {
    if (!page || page.cols.length !== 2) return;
    var L = page.cols[0], R = page.cols[1];
    if (R.children.length !== 0 || L.children.length < 2) return;
    var moved = 0;
    while (L.children.length > 1) {
      var last = L.lastElementChild;
      var h = last.offsetHeight;
      if (used(L) - h < used(R) + h - 2) break;
      R.insertBefore(last, R.firstChild);
      // Never leave a heading at the bottom of the left column.
      if (L.lastElementChild && L.lastElementChild.getAttribute("data-keepnext")) R.insertBefore(L.lastElementChild, R.firstChild);
      moved++;
      if (!fits(R)) {
        L.appendChild(R.firstElementChild);
        break;
      }
    }
    return moved;
  }

  /* ---------------- report ---------------- */

  function audit() {
    report.pages = out.children.length;
    report.katexErrors = out.querySelectorAll(".katex-error").length;
    Array.prototype.forEach.call(out.querySelectorAll(".page"), function (sec) {
      var n = Number(sec.getAttribute("data-page"));
      var content = sec.querySelectorAll(".flow > *").length;
      if (!content) report.emptyPages.push(n);
      var body = sec.querySelector(".body").getBoundingClientRect();
      Array.prototype.forEach.call(sec.querySelectorAll(".flow > .blk"), function (b) {
        var r = b.getBoundingClientRect();
        var wide = b.scrollWidth > b.clientWidth + 2 || r.right > body.right + 2 || r.left < body.left - 2;
        var inner = b.querySelector(".katex-display, .katex, table, img");
        var innerWide = false;
        Array.prototype.forEach.call(b.querySelectorAll(".katex-display > .katex, table, img"), function (el) {
          if (el.getBoundingClientRect().right > body.right + 2) innerWide = true;
        });
        if (wide || innerWide) report.clipped.push({ page: n, node: b.getAttribute("data-node") });
        void inner;
      });
      Array.prototype.forEach.call(sec.querySelectorAll("img"), function (img) {
        if (!img.complete || img.naturalWidth === 0) {
          report.missingImages.push({ page: n, src: img.getAttribute("src") });
          return;
        }
        var widthIn = img.getBoundingClientRect().width / 96;
        if (widthIn > 0.2 && !img.closest(".wm")) {
          var dpi = img.naturalWidth / widthIn;
          if (dpi < 200) report.lowRes.push({ page: n, dpi: Math.round(dpi), node: (img.closest(".blk") || {}).getAttribute ? img.closest(".blk").getAttribute("data-node") : null });
        }
      });
    });
    var fams = ['10pt "Noto Serif"', 'bold 10pt "Noto Serif"', '10pt "Noto Sans"'];
    report.fontsOk = fams.every(function (f) { return document.fonts.check(f); });
  }

  /* ---------------- main ---------------- */

  function waitImages() {
    var imgs = Array.prototype.slice.call(document.images);
    return Promise.all(imgs.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (res) { img.onload = img.onerror = function () { res(); }; });
    }));
  }

  function run() {
    var items = Array.prototype.slice.call(src.children);
    var chapterOpenPage = false;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.classList.contains("chapter-start")) {
        if (page) balance();
        chapter = { title: el.getAttribute("data-title"), number: el.getAttribute("data-number") };
        // Without a chapter title there is nothing to open with: use a normal page.
        makePage(chapter.title ? "opener" : "normal");
        chapterOpenPage = true;
        continue;
      }
      if (!page) makePage("opener");
      if (el.classList.contains("fullpage")) {
        balance();
        makePage("full");
        cur().appendChild(el);
        if (!fits(cur())) report.overflows.push({ page: pageNo, node: "answer-key" });
        page.idx = page.cols.length - 1;
        page.full = true;
        continue;
      }
      if (page.full) makePage("normal");
      var next = null;
      for (var j = i + 1; j < items.length; j++) {
        if (!items[j].classList.contains("chapter-start")) { next = items[j]; break; }
      }
      place(el, next && !next.classList.contains("fullpage") ? next : null);
      chapterOpenPage = false;
    }
    if (!page) makePage("opener");
    balance();
    void chapterOpenPage;
    src.innerHTML = "";
    audit();
    if (CFG.interactive) wireInteractive();
    window.__PAGINATION = report;
    document.title = document.title + " — " + report.pages + " pages";
  }

  function wireInteractive() {
    out.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".blk[data-node]") : null;
      if (!b) return;
      Array.prototype.forEach.call(out.querySelectorAll(".blk.sel"), function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
      parent.postMessage({ type: "book-node-click", nodeId: b.getAttribute("data-node") }, "*");
    });
    window.addEventListener("message", function (e) {
      if (!e.data || e.data.type !== "book-node-focus") return;
      var els = out.querySelectorAll('.blk[data-node="' + CSS.escape(e.data.nodeId) + '"]');
      Array.prototype.forEach.call(out.querySelectorAll(".blk.sel"), function (x) { x.classList.remove("sel"); });
      if (els[0]) {
        Array.prototype.forEach.call(els, function (x) { x.classList.add("sel"); });
        els[0].scrollIntoView({ block: "center" });
      }
    });
    parent.postMessage({ type: "book-paginated", report: report }, "*");
  }

  var loads = [
    '400 10pt "Noto Serif"', '700 10pt "Noto Serif"', 'italic 400 10pt "Noto Serif"', 'italic 700 10pt "Noto Serif"',
    '400 10pt "Noto Sans"', '700 10pt "Noto Sans"',
  ].map(function (f) { return document.fonts.load(f).catch(function () {}); });
  Promise.all(loads)
    .then(function () { return document.fonts.ready; })
    .then(waitImages)
    .then(run)
    .catch(function (err) {
      window.__PAGINATION = { error: String(err) };
    });
})();
