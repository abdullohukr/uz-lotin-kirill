/*
 * Converts a Word document (or the selection) word by word.
 *
 * Every paragraph is split into word ranges and only the ranges whose text
 * changes are replaced, so formatting (bold, highlight, font, size), footnote
 * marks, pictures and all punctuation - including « » quotes - stay in place.
 */
/* global Word, UzTranslit */
(function (root) {
  "use strict";

  // Split points. Apostrophes are NOT here: they belong to Latin words (o‘, ma’no).
  var DELIMS = [" ", " ", "\t", ",", ".", ":", ";", "!", "?", "«", "»", "“", "”", "„",
    "\"", "(", ")", "[", "]", "/", "-", "–", "—", "…"];
  var PARAS_PER_BATCH = 40;
  // Footnote marks, fields, pictures etc. show up as control characters in range text.
  var OBJECT_CHARS = /[\u0000-\u0008\u000B-\u001F￼]/;
  var WORD_RE = /[A-Za-zЀ-ӿ'`´‘’ʻʼ]+/g;

  // Word may draw inserted Cyrillic with the East Asian font when the document's
  // East Asian language is Japanese/Chinese (wide, serif letters). Give the new
  // text the word's own font in the East Asian slot too.
  var HAS_FAR_EAST = false;
  function fixFont(range, fontName) {
    if (!fontName) return;
    if (HAS_FAR_EAST) range.font.nameFarEast = fontName;
    else range.font.name = fontName;
  }

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

  async function convertParagraphBatch(ctx, paras, convert, limitTo, stats) {
    // 1. split each paragraph into word ranges
    var groups = paras.map(function (p) {
      var r = p.getRange("Content");
      if (limitTo) {
        // only the selected part of the paragraph
        r = r.intersectWithOrNullObject(limitTo);
        r.load("isNullObject");
      }
      return r;
    });
    if (limitTo) await ctx.sync();
    var splits = [];
    groups.forEach(function (r) {
      if (limitTo && r.isNullObject) return;
      var s = r.split(DELIMS, false, true, false);
      s.load("items/text,items/font/name");
      splits.push({ r: r, s: s });
    });
    await ctx.sync();

    // 2. replace only what changes
    var searches = [];
    splits.forEach(function (sp) {
      sp.s.items.forEach(function (wr) {
        var text = wr.text;
        if (!text) return;
        var out = convert(text);
        if (out === text) return;
        if (!OBJECT_CHARS.test(text)) {
          var fontName = wr.font.name;
          fixFont(wr.insertText(out, "Replace"), fontName);
          stats.words++;
          return;
        }
        // The range holds an object (footnote mark, field...). Replace only the
        // letters, word by word, so the object itself is never deleted.
        var m, seen = {};
        WORD_RE.lastIndex = 0;
        while ((m = WORD_RE.exec(text))) {
          var w = m[0], o = convert(w);
          if (o === w || seen[w]) continue;
          seen[w] = true;
          var found = wr.search(w, { matchCase: true });
          found.load("items/font/name");
          searches.push({ found: found, out: o });
        }
      });
    });
    if (searches.length) {
      await ctx.sync();
      searches.forEach(function (s) {
        s.found.items.forEach(function (r) {
          var fontName = r.font.name;
          fixFont(r.insertText(s.out, "Replace"), fontName);
          stats.words++;
        });
      });
    }
    await ctx.sync();
  }

  /*
   * direction: "lat" (to Latin) | "cyr" (to Cyrillic)
   * scope: "auto" (selection if something is selected, else whole document) |
   *        "selection" | "document"
   */
  async function convertInWord(direction, scope, settings, onProgress) {
    var t = makeEngine(settings);
    try {
      HAS_FAR_EAST = !!(Office.context.requirements &&
        Office.context.requirements.isSetSupported("WordApiDesktop", "1.3"));
    } catch (e) { HAS_FAR_EAST = false; }
    var convert = direction === "lat" ? t.toLatin : t.toCyrillic;
    var stats = { words: 0, paragraphs: 0, scope: "document" };

    await Word.run(async function (ctx) {
      var sel = ctx.document.getSelection();
      sel.load("text");
      await ctx.sync();
      var hasSel = sel.text && sel.text.replace(/\s/g, "").length > 0;
      var useSel = scope === "selection" || (scope === "auto" && hasSel);
      if (scope === "selection" && !hasSel) throw new Error("Avval matnni belgilang.");
      stats.scope = useSel ? "selection" : "document";

      var stories = await collectStories(ctx, useSel);
      var total = 0, done = 0;
      var paraLists = [];
      for (var i = 0; i < stories.length; i++) {
        var ps = stories[i].range.paragraphs;
        ps.load("items/text");
        paraLists.push(ps);
      }
      try { await ctx.sync(); } catch (e) {
        // some header/footer kinds may not exist: load one by one and drop failures
        paraLists = [];
        for (var j = 0; j < stories.length; j++) {
          try {
            var p2 = stories[j].range.paragraphs; p2.load("items/text");
            await ctx.sync();
            paraLists.push(p2);
          } catch (e2) { /* skip */ }
        }
      }
      // only paragraphs that contain letters of the source script
      var srcRe = direction === "lat" ? /[\u0400-\u04FF]/ : /[A-Za-z]/;
      var work = paraLists.map(function (pl) {
        return pl.items.filter(function (p) { return srcRe.test(p.text || ""); });
      });
      work.forEach(function (items) { total += items.length; });

      for (var k = 0; k < work.length; k++) {
        var items = work[k];
        for (var b = 0; b < items.length; b += PARAS_PER_BATCH) {
          var batch = items.slice(b, b + PARAS_PER_BATCH);
          await convertParagraphBatch(ctx, batch, convert, useSel ? sel : null, stats);
          done += batch.length;
          stats.paragraphs = done;
          if (onProgress) onProgress(done, total);
        }
      }
    });
    return stats;
  }

  root.UzWord = { convertInWord: convertInWord };
})(typeof globalThis !== "undefined" ? globalThis : this);
