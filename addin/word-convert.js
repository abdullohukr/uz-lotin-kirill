/*
 * Converts a Word document (or the selection).
 *
 * Main path: every paragraph's OOXML is read, only the text inside <w:t> is
 * converted (addin/ooxml.js) and the paragraph is written back. Formatting,
 * highlights, fonts and all punctuation - including « » quotes - stay as they
 * were. Writing through OOXML also avoids a Word quirk: insertText marks new
 * Cyrillic as East Asian text in documents whose East Asian language is
 * Japanese/Chinese and draws it with a wide Japanese font.
 *
 * A partly selected paragraph goes the same way: only words inside the
 * selection change.
 *
 * Fallback path (paragraphs with footnote marks, fields, pictures, tracked
 * changes): word ranges are replaced one by one.
 */
/* global Word, UzTranslit, UzOoxml */
(function (root) {
  "use strict";

  // Split points for the fallback path. Apostrophes are NOT here: they belong to Latin words.
  var DELIMS = [" ", " ", "\t", ",", ".", ":", ";", "!", "?", "«", "»", "“", "”", "„",
    "\"", "(", ")", "[", "]", "/", "-", "–", "—", "…"];
  var PARAS_PER_BATCH = 30;
  // Footnote marks, fields, pictures etc. show up as control characters in range text.
  var OBJECT_CHARS = /[\u0000-\u0008\u000B-\u001F￼]/;

  function makeEngine(settings) {
    var t = UzTranslit.create(root.UZ_EXCEPTIONS || {}, {
      okina: settings.okina,
      tutuq: settings.tutuq
    });
    if (settings.userPairs && settings.userPairs.length) t.addUserPairs(settings.userPairs);
    if (settings.skipWords && settings.skipWords.length) t.addSkipWords(settings.skipWords);
    return t;
  }

  // Collect every story we can reach: body, footnotes, endnotes, headers/footers.
  async function collectStories(ctx, useSelection) {
    if (useSelection) return [{ range: ctx.document.getSelection(), name: "selection" }];
    var stories = [{ range: ctx.document.body.getRange("Whole"), name: "body" }];
    try {
      var fns = ctx.document.body.footnotes; fns.load("items");
      var ens = ctx.document.body.endnotes; ens.load("items");
      await ctx.sync();
      fns.items.forEach(function (f) { stories.push({ range: f.body.getRange("Whole"), name: "footnote" }); });
      ens.items.forEach(function (f) { stories.push({ range: f.body.getRange("Whole"), name: "endnote" }); });
    } catch (e) { /* footnotes API not available in this Word version */ }
    try {
      var secs = ctx.document.sections; secs.load("items");
      await ctx.sync();
      secs.items.forEach(function (s) {
        ["Primary", "FirstPage", "EvenPages"].forEach(function (kind) {
          stories.push({ range: s.getHeader(kind).getRange("Whole"), name: "header" });
          stories.push({ range: s.getFooter(kind).getRange("Whole"), name: "footer" });
        });
      });
    } catch (e) { /* ignore */ }
    return stories;
  }

  // Fallback: replace word ranges of the given ranges one by one.
  async function convertByWords(ctx, ranges, convert, stats) {
    var splits = ranges.map(function (r) {
      var s = r.split(DELIMS, false, true, false);
      s.load("items/text");
      return s;
    });
    await ctx.sync();
    var searches = [];
    splits.forEach(function (s) {
      s.items.forEach(function (wr) {
        var text = wr.text;
        if (!text) return;
        var out = convert(text);
        if (out === text) return;
        if (!OBJECT_CHARS.test(text)) {
          wr.insertText(out, "Replace");
          stats.words++;
          return;
        }
        // The range holds an object (footnote mark, field...): replace only the
        // letters, word by word, so the object itself is never deleted.
        var re = UzTranslit.wordRegex(stats.script), m, seen = {};
        while ((m = re.exec(text))) {
          var w = m[0], o = convert(w);
          if (o === w || seen[w]) continue;
          seen[w] = true;
          var found = wr.search(w, { matchCase: true });
          found.load("items");
          searches.push({ found: found, out: o });
        }
      });
    });
    if (searches.length) {
      await ctx.sync();
      searches.forEach(function (s) {
        s.found.items.forEach(function (r) { r.insertText(s.out, "Replace"); stats.words++; });
      });
    }
    await ctx.sync();
  }

  async function convertParagraphBatch(ctx, paras, t, limitTo, stats) {
    var convert = stats.script === "cyr" ? t.toLatin : t.toCyrillic;
    var wordFn = stats.script === "cyr" ? t.wordToLatin : t.wordToCyrillic;

    // 1. which paragraphs are completely inside the selection (all of them without one)
    var WHOLE = { Inside: 1, InsideStart: 1, InsideEnd: 1, Equal: 1 };
    var info = paras.map(function (p) {
      var o = { p: p, whole: true, part: null, cmp: null, window: null };
      if (limitTo) {
        o.cmp = p.getRange("Content").compareLocationWith(limitTo);
        o.part = p.getRange("Content").intersectWithOrNullObject(limitTo);
        o.part.load("isNullObject");
      }
      return o;
    });
    if (limitTo) {
      await ctx.sync();
      info.forEach(function (o) { o.whole = !!WHOLE[o.cmp.value]; });
      // partly selected paragraph: offsets of the selected part in the paragraph text
      info.forEach(function (o) {
        if (o.whole || o.part.isNullObject) return;
        o.pre = o.p.getRange("Start").expandTo(o.part.getRange("Start"));
        o.pre.load("text");
        o.part.load("text");
      });
      await ctx.sync();
      info.forEach(function (o) {
        if (o.whole || o.part.isNullObject) return;
        var from = o.pre.text.length;
        o.window = [from, from + o.part.text.length];
      });
    }

    // 2. read OOXML of the paragraphs
    info.forEach(function (o) { if (o.whole || o.window) o.ox = o.p.getOoxml(); });
    await ctx.sync();

    // 3. convert; write paragraphs back, collect the rest for the fallback
    var fallback = [];
    info.forEach(function (o) {
      if (!o.ox) return;
      var res = UzOoxml.convertPackage(o.ox.value, wordFn, stats.script, UzTranslit.wordRegex, o.window);
      if (res.risky) {
        fallback.push(o.window ? o.part : o.p.getRange("Content"));
        stats.fallbackParas++;
        return;
      }
      if (res.changed) {
        o.p.insertOoxml(res.xml, "Replace");
        stats.words += res.words;
        stats.ooxmlParas++;
      }
    });
    await ctx.sync();
    if (fallback.length) await convertByWords(ctx, fallback, convert, stats);
  }

  /*
   * direction: "lat" (to Latin) | "cyr" (to Cyrillic)
   * scope: "auto" (selection if something is selected, else whole document) |
   *        "selection" | "document"
   */
  async function convertInWord(direction, scope, settings, onProgress) {
    var t = makeEngine(settings);
    var stats = {
      words: 0, paragraphs: 0, scope: "document", ooxmlParas: 0, fallbackParas: 0, extraParas: 0,
      script: direction === "lat" ? "cyr" : "lat"   // script of the SOURCE words
    };

    await Word.run(async function (ctx) {
      var sel = ctx.document.getSelection();
      sel.load("text");
      await ctx.sync();
      var hasSel = sel.text && sel.text.replace(/\s/g, "").length > 0;
      var useSel = scope === "selection" || (scope === "auto" && hasSel);
      if (scope === "selection" && !hasSel) throw new Error("Avval matnni belgilang.");
      stats.scope = useSel ? "selection" : "document";

      var stories = await collectStories(ctx, useSel);
      var lists = [];
      for (var i = 0; i < stories.length; i++) {
        var ps = stories[i].range.paragraphs;
        ps.load("items/text");
        lists.push({ story: stories[i], ps: ps });
      }
      try { await ctx.sync(); } catch (e) {
        // some header/footer kinds may not exist: load one by one and drop failures
        lists = [];
        for (var j = 0; j < stories.length; j++) {
          try {
            var p2 = stories[j].range.paragraphs; p2.load("items/text");
            await ctx.sync();
            lists.push({ story: stories[j], ps: p2 });
          } catch (e2) { /* skip */ }
        }
      }

      // only paragraphs that contain letters of the source script
      var srcRe = direction === "lat" ? /[Ѐ-ӿ]/ : /[A-Za-z]/;
      var total = 0, done = 0;
      lists.forEach(function (l) {
        l.count = l.ps.items.length;
        l.work = l.ps.items.filter(function (p) { return srcRe.test(p.text || ""); });
        total += l.work.length;
      });

      for (var k = 0; k < lists.length; k++) {
        var items = lists[k].work;
        for (var b = 0; b < items.length; b += PARAS_PER_BATCH) {
          var batch = items.slice(b, b + PARAS_PER_BATCH);
          await convertParagraphBatch(ctx, batch, t, useSel ? sel : null, stats);
          done += batch.length;
          stats.paragraphs = done;
          if (onProgress) onProgress(done, total);
        }
        // safety check: writing OOXML must not add paragraphs
        if (items.length && !useSel) {
          var after = lists[k].story.range.paragraphs;
          after.load("items");
          await ctx.sync();
          if (after.items.length > lists[k].count) stats.extraParas += after.items.length - lists[k].count;
        }
      }
    });
    return stats;
  }

  root.UzWord = { convertInWord: convertInWord };
})(typeof globalThis !== "undefined" ? globalThis : this);
