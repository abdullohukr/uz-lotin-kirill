/*
 * Converts the text of a Word OOXML package (as returned by Range.getOoxml())
 * without touching anything else: only the contents of <w:t> elements in the
 * main document part change.
 *
 * Why: Word's insertText marks inserted Cyrillic as East Asian text
 * (w:hint="eastAsia") in documents whose East Asian language is Japanese or
 * Chinese, and then draws it with a wide Japanese font. Text written through
 * OOXML keeps the run's own fonts; the hint is also removed from changed runs.
 */
(function (root) {
  "use strict";

  // Elements that stand for one character in Word's paragraph text (tab, line break...).
  // They end a word, and they keep offsets equal to Range.text offsets.
  var ONE_CHAR = /<w:(tab|br|cr|ptab|sym|noBreakHyphen|softHyphen)\b/g;
  // Paragraphs we do not rewrite (their content would be re-created on insert).
  var RISKY = /<w:(footnoteReference|endnoteReference|commentReference|fldChar|fldSimple|drawing|pict|object|sdt|ins|del|moveFrom|moveTo)\b/;
  var WT = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
  var RUN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  var MARK = " uzlk-changed=\"1\"";

  function unesc(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&amp;/g, "&");
  }
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Locate the main document body inside a flat-OPC package (or a bare document.xml).
  function bodyBounds(pkg) {
    var part = pkg.indexOf('pkg:name="/word/document.xml"');
    var from = part >= 0 ? part : 0;
    var b = pkg.indexOf("<w:body>", from);
    var e = pkg.indexOf("</w:body>", b);
    if (b < 0 || e < 0) return null;
    return [b, e];
  }

  /*
   * pkg: OOXML string. convertWord(word) -> converted word. script: "lat" | "cyr"
   * (the script of the SOURCE words). window: optional [from, to] in paragraph
   * text offsets (as Range.text counts them) - only words fully inside change.
   * Returns { xml, changed, words, risky }.
   */
  function convertPackage(pkg, convertWord, script, wordRegex, window) {
    var bb = bodyBounds(pkg);
    if (!bb) return { xml: pkg, changed: 0, risky: true };
    var body = pkg.slice(bb[0], bb[1]);
    if (RISKY.test(body)) return { xml: pkg, changed: 0, risky: true };

    // 1. collect <w:t> nodes and the joined text
    var nodes = [], joined = "", m, lastEnd = 0;
    WT.lastIndex = 0;
    while ((m = WT.exec(body))) {
      var gap = body.slice(lastEnd, m.index);
      var ones = (gap.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, "").match(ONE_CHAR) || []).length;
      for (var g = 0; g < ones; g++) joined += "\u0000";
      var text = unesc(m[2]);
      nodes.push({ start: m.index, end: m.index + m[0].length, attrs: m[1] || "", text: text, pos: joined.length, out: null });
      joined += text;
      lastEnd = m.index + m[0].length;
    }
    if (!nodes.length) return { xml: pkg, changed: 0, risky: false };

    // 2. find words to change: [from, to, replacement]
    var edits = [];
    var re = wordRegex(script);
    var urls = root.UzTranslit.urlSpans(joined);
    while ((m = re.exec(joined))) {
      if (urls.length && root.UzTranslit.inSpans(urls, m.index, m.index + m[0].length)) continue;
      if (window && (m.index < window[0] || m.index + m[0].length > window[1])) continue;
      var out = convertWord(m[0]);
      if (out !== m[0]) edits.push([m.index, m.index + m[0].length, out]);
    }
    if (!edits.length) return { xml: pkg, changed: 0, risky: false };

    // 3. rebuild each node: a whole replacement goes into the node where the word starts
    var ei = 0;
    nodes.forEach(function (n) {
      var res = "", touched = false;
      for (var i = 0; i < n.text.length; i++) {
        var gp = n.pos + i;
        while (ei < edits.length && edits[ei][1] <= gp) ei++;
        var ed = edits[ei];
        if (ed && gp >= ed[0] && gp < ed[1]) {
          if (gp === ed[0]) res += ed[2];
          touched = true;
        } else {
          res += n.text[i];
        }
      }
      if (touched) n.out = res;
    });

    // 4. write back from the end so indices stay valid (changed nodes get a marker)
    var changed = 0;
    for (var k = nodes.length - 1; k >= 0; k--) {
      var n = nodes[k];
      if (n.out === null) continue;
      changed++;
      var attrs = n.attrs;
      if (/^\s|\s$/.test(n.out) && attrs.indexOf("xml:space") < 0) attrs += ' xml:space="preserve"';
      body = body.slice(0, n.start) + "<w:t" + attrs + MARK + ">" + esc(n.out) + "</w:t>" + body.slice(n.end);
    }
    // 5. in runs with changed text drop the East Asian hint, then remove the markers
    body = body.replace(RUN, function (run) {
      if (run.indexOf(MARK) < 0) return run;
      return run.replace(/\s+w:hint="eastAsia"/g, "").split(MARK).join("");
    });
    return { xml: pkg.slice(0, bb[0]) + body + pkg.slice(bb[1]), changed: changed, words: edits.length, risky: false };
  }

  root.UzOoxml = { convertPackage: convertPackage, RISKY: RISKY };
})(typeof globalThis !== "undefined" ? globalThis : this);
