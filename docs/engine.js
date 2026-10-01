/*
 * Uzbek Latin <-> Cyrillic transliteration engine.
 *
 * Only letters (and the apostrophes that belong to words) are touched.
 * Quotes « » “ ” " ' , digits, punctuation and spacing are never changed.
 *
 * Usage:
 *   var t = UzTranslit.create(exceptionsJson, { okina: "‘", tutuq: "’" });
 *   t.toCyrillic("O‘zbekiston «Salom» dedi")  // Ўзбекистон «Салом» деди
 *   t.toLatin("Ўзбекистон «Салом» деди")     // O‘zbekiston «Salom» dedi
 */
(function (root) {
  "use strict";

  // Internal markers for the two apostrophe roles after normalisation.
  var OK = "ʻ"; // ʻ  (o‘, g‘)
  var TQ = "ʼ"; // ʼ  (tutuq belgisi)

  // Everything people type instead of ʻ / ʼ.
  var APOS = "'`´‘’‛ʻʼʹʽ′＇";
  var APOS_SET = {};
  for (var i = 0; i < APOS.length; i++) APOS_SET[APOS[i]] = true;

  var LAT_VOWELS = { a: 1, e: 1, i: 1, o: 1, u: 1 };
  var CYR_VOWELS = { "а": 1, "е": 1, "ё": 1, "и": 1, "о": 1, "у": 1, "э": 1, "ю": 1, "я": 1, "ў": 1 };

  var LAT_CYR = {
    a: "а", b: "б", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к",
    l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т",
    u: "у", v: "в", x: "х", y: "й", z: "з", e: "е"
  };

  var CYR_LAT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ж": "j", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x",
    "ҳ": "h", "қ": "q", "ч": "ch", "ш": "sh", "щ": "sh", "ы": "i", "э": "e",
    "ё": "yo", "ю": "yu", "я": "ya", "ь": ""
  };

  // Latin word: letters, plus an apostrophe that is followed by a letter
  // or that directly follows o/g (o‘ / g‘ at the end of a word: obro‘, tog‘).
  // ...and a final ’ / ʼ after another letter (ayn: Yusha’, shay’); planEdits
  // gives it back when it closes a single quote (‘Salom’).
  var LAT_WORD_RE = new RegExp(
    "[A-Za-z](?:[A-Za-z]|[" + APOS + "](?=[A-Za-z])|(?<=[oOgG])[" + APOS + "]|(?<=[A-Za-z])[\u2019\u02BC](?![A-Za-z]))*",
    "g"
  );
  var CYR_WORD_RE = /[Ѐ-ӿ]+/g;
  var ROMAN_RE = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

  // Clearly foreign (non-Uzbek) Latin words: letters or spellings Uzbek never uses,
  // or a capital inside the word (YouTube, iPhone, CadenzaX).
  var FOREIGN_LETTERS = /[wW]|[cC](?![hH])/;
  var FOREIGN_SPELLING = /ph|ee(?!['\u02BB\u02BC\u2018\u2019])|gh|ck|[^aeiou'\u02BB\u02BC\u2018\u2019]le$|[^aeiouy'\u02BB\u02BC\u2018\u2019]y$/;
  function isStrongForeign(word) {
    if (FOREIGN_LETTERS.test(word)) return true;
    if (/[a-z][A-Z]/.test(word)) return true;                    // CamelCase
    var lw = word.toLowerCase();
    return lw.length >= 4 && FOREIGN_SPELLING.test(lw);
  }

  function isUpper(ch) {
    return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
  }
  function isLetter(ch) {
    return ch !== undefined && ch.toLowerCase() !== ch.toUpperCase();
  }

  // "lower" | "title" | "upper" | "mixed"
  function casePattern(word) {
    var letters = [];
    for (var i = 0; i < word.length; i++) if (isLetter(word[i])) letters.push(word[i]);
    if (!letters.length) return "lower";
    var up = 0;
    for (var j = 0; j < letters.length; j++) if (isUpper(letters[j])) up++;
    if (up === 0) return "lower";
    if (up === letters.length) return letters.length > 1 ? "upper" : "title";
    if (up === 1 && isUpper(letters[0])) return "title";
    return "mixed";
  }

  function applyCase(pattern, out) {
    if (pattern === "upper") return out.toUpperCase();
    if (pattern === "title" || pattern === "mixed") {
      for (var i = 0; i < out.length; i++) {
        if (isLetter(out[i])) return out.slice(0, i) + out[i].toUpperCase() + out.slice(i + 1);
      }
    }
    return out;
  }

  // Normalise apostrophes in a Latin word: after o/g -> OK, otherwise -> TQ.
  function normLatin(word) {
    var r = "";
    for (var i = 0; i < word.length; i++) {
      var ch = word[i];
      if (APOS_SET[ch]) {
        var p = word[i - 1];
        r += (p === "o" || p === "O" || p === "g" || p === "G") ? OK : TQ;
      } else r += ch;
    }
    return r;
  }

  // ---------------------------------------------------------------- Latin -> Cyrillic rules
  // w is a normalised (OK/TQ) word in original case; start is the index where
  // conversion begins (> 0 when a stem exception already produced the prefix).
  function latRules(w, start) {
    var lw = w.toLowerCase();
    var allUp = casePattern(w) === "upper";
    var out = "";
    var i = start || 0;
    function prevLetter(k) { // previous source char (lowercase) before index k
      return k > 0 ? lw[k - 1] : "";
    }
    function emit(cyr, srcIdx) {
      out += (allUp || isUpper(w[srcIdx])) ? cyr.toUpperCase() : cyr;
    }
    while (i < lw.length) {
      var c = lw[i], n = lw[i + 1], n2 = lw[i + 2];
      var p = prevLetter(i);
      var atStart = i === 0;
      if (c === "s" && n === TQ && n2 === "h") { emit("сҳ", i); i += 3; continue; }
      if (c === "s" && n === "h") { emit("ш", i); i += 2; continue; }
      if (c === "c" && n === "h") { emit("ч", i); i += 2; continue; }
      if (c === "o" && n === OK) { emit("ў", i); i += 2; continue; }
      if (c === "g" && n === OK) { emit("ғ", i); i += 2; continue; }
      if (c === "y") {
        if (n === "o" && n2 !== OK) { emit("ё", i); i += 2; continue; }
        if (n === "u") { emit("ю", i); i += 2; continue; }
        if (n === "a") { emit("я", i); i += 2; continue; }
        if (n === "e" && (atStart || LAT_VOWELS[p] || p === OK || p === TQ)) { emit("е", i); i += 2; continue; }
      }
      if (c === "t" && n === "s") {
        // -tsiya / -tsion (Russian loans: inflyatsiya, revolyutsion) -> ц
        var rest = lw.slice(i + 2, i + 6);
        if (rest.indexOf("iya") === 0 || rest.indexOf("ion") === 0) { emit("ц", i); i += 2; continue; }
      }
      if (c === "e") {
        // surnames: Abdullaev, Boboev, Tillaeva, Mirzaevich -> ев (but mikroevolyutsiya -> эв)
        var surname = (p === "a" || p === "o" || p === "u") && n === "v" &&
          !(n2 === "o" || n2 === "e" || n2 === "u");
        emit(((atStart || LAT_VOWELS[p]) && !surname) ? "э" : "е", i);
        i++; continue;
      }
      // mo‘jiza, mo‘tabar, mo‘tadil, mo‘jaz -> мўъж / мўът (word start)
      if (atStart && c === "m" && n === "o" && n2 === OK && (lw[i + 3] === "j" || lw[i + 3] === "t")) {
        emit("м", i); emit("ўъ", i + 1); i += 3; continue;
      }
      if (c === TQ || c === OK) { out += (allUp ? "Ъ" : "ъ"); i++; continue; }
      if (LAT_CYR[c]) { emit(LAT_CYR[c], i); i++; continue; }
      out += w[i]; i++;
    }
    return out;
  }

  // ---------------------------------------------------------------- Cyrillic -> Latin rules
  function cyrRules(w, start, opt) {
    var lw = w.toLowerCase();
    var allUp = casePattern(w) === "upper";
    var out = "";
    var okc = opt.okina, tqc = opt.tutuq;
    function emit(lat, srcIdx) {
      if (allUp) { out += lat.toUpperCase(); return; }
      if (isUpper(w[srcIdx])) {
        // Ш -> SH before another capital (ШАҲАР inside mixed text), else Sh
        var nx = w[srcIdx + 1];
        var nextUp = nx !== undefined && isLetter(nx) && isUpper(nx);
        out += nextUp ? lat.toUpperCase() : lat.charAt(0).toUpperCase() + lat.slice(1);
        return;
      }
      out += lat;
    }
    var i = start || 0;
    while (i < lw.length) {
      var c = lw[i], n = lw[i + 1];
      var p = i > 0 ? lw[i - 1] : "";
      var atStart = i === 0;
      if (c === "с" && n === "ҳ") { emit("s" + tqc + "h", i); i += 2; continue; }
      if (c === "ў") { emit("o" + okc, i); i += (n === "ъ" ? 2 : 1); continue; }
      if (c === "ғ") { emit("g" + okc, i); i += (n === "ъ" ? 2 : 1); continue; }
      if (c === "е") {
        emit((atStart || CYR_VOWELS[p] || p === "ъ" || p === "ь") ? "ye" : "e", i);
        i++; continue;
      }
      if (c === "ц") { emit(CYR_VOWELS[p] ? "ts" : "s", i); i++; continue; }
      if (c === "ъ") {
        // объект -> obyekt: ъ after a consonant before е/ё/ю/я is dropped
        var softNext = n === "е" || n === "ё" || n === "ю" || n === "я";
        if (softNext && p && !CYR_VOWELS[p]) { i++; continue; }
        out += tqc; i++; continue;
      }
      if (CYR_LAT[c] !== undefined) { emit(CYR_LAT[c], i); i++; continue; }
      out += w[i]; i++;
    }
    return out;
  }

  // ---------------------------------------------------------------- exceptions
  function buildIndex(list) {
    // list: { exact: {key: value}, stems: [[key, value], ...] }
    var exact = {}, stems = {}, maxStem = 0;
    if (list && list.exact) for (var k in list.exact) exact[k] = list.exact[k];
    if (list && list.stems) {
      for (var i = 0; i < list.stems.length; i++) {
        var s = list.stems[i];
        stems[s[0]] = s[1];
        if (s[0].length > maxStem) maxStem = s[0].length;
      }
    }
    return { exact: exact, stems: stems, maxStem: maxStem };
  }

  function addPairs(index, pairs) {
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      if (a && b) index.exact[a] = b;
    }
  }

  // Latin keys are stored lowercase with ' for every apostrophe.
  function latKey(normWord) {
    return normWord.toLowerCase().replace(/[ʻʼ]/g, "'");
  }

  function create(exceptions, options) {
    var opt = {
      okina: "‘",   // o‘ g‘
      tutuq: "’",   // ma’no
      keepForeign: true  // keep English words / brand names in Latin
    };
    if (options) for (var k in options) opt[k] = options[k];
    exceptions = exceptions || {};
    var l2c = buildIndex(exceptions.lat2cyr);
    var c2l = buildIndex(exceptions.cyr2lat);
    var skip = {};
    // English words kept in Latin inside quotes or next to a clearly foreign word
    var weak = {};
    (exceptions.foreign || []).forEach(function (w) { weak[w] = true; });
    // words that stay Latin everywhere, in any case (VIP, SMS, PDF, online...)
    var acronyms = {};
    (exceptions.acronyms || []).forEach(function (w) { acronyms[w] = true; });

    function isWeakForeign(word) {
      var lw = word.toLowerCase();
      return !!(weak[lw] || (lw.length > 3 && /s$/.test(lw) && weak[lw.slice(0, -1)]));
    }
    function isAcronym(word) {
      return !!acronyms[word.toLowerCase()];
    }

    var QUOTE_SPAN = /[«“„"]([^«»“”„"\n]{1,120})[»”“"]/g;

    /*
     * Decides which words of a text change: [[from, to, replacement], ...].
     * script: "lat" (Latin words -> Cyrillic) or "cyr".
     * Links and e-mails never change. Going to Cyrillic, names in quotes that
     * contain a foreign word («Gold Kvest», «CadenzaX music») and capitalised
     * names joined to a clearly foreign word (Apple Music) stay in Latin.
     */
    function planEdits(text, script) {
      var re = new RegExp((script === "lat" ? LAT_WORD_RE : CYR_WORD_RE).source, "g");
      var fn = script === "lat" ? wordToCyrillic : wordToLatin;
      var urls = urlSpans(text);
      var toks = [], m;
      while ((m = re.exec(text))) {
        var w = m[0];
        // ‘Salom’: the final ’ closes a single quote, it is not part of the word
        if (/[\u2019\u02BC]$/.test(w) && !/[oOgG][\u2019\u02BC]$/.test(w) &&
            /[\u2018']/.test(text.charAt(m.index - 1))) w = w.slice(0, -1);
        toks.push({ s: m.index, e: m.index + w.length, w: w, keep: false });
      }
      if (script === "lat" && opt.keepForeign) {
        toks.forEach(function (t) {
          t.strong = isStrongForeign(t.w) || isAcronym(t.w);
          t.foreign = t.strong || isWeakForeign(t.w);
          if (t.strong) t.keep = true;
        });
        // names in quotes
        QUOTE_SPAN.lastIndex = 0;
        while ((m = QUOTE_SPAN.exec(text))) {
          var a = m.index, b = m.index + m[0].length;
          var inside = toks.filter(function (t) { return t.s > a && t.e < b; });
          // only short names: «VIP», «CadenzaX music», «Gold Kvest» - never quotations
          if (!inside.length || inside.length > 4) continue;
          var strong = inside.some(function (t) { return t.strong; });
          var nameLike = inside.length >= 2 &&
            inside.every(function (t) { return isUpper(t.w[0]); }) &&
            inside.some(function (t) { return t.foreign; });
          if (strong || nameLike) inside.forEach(function (t) { t.keep = true; });
        }
        // capitalised names joined by spaces: Apple Music, Smarts Vey
        var i = 0;
        while (i < toks.length) {
          var j = i;
          while (j + 1 < toks.length && isUpper(toks[j + 1].w[0]) && isUpper(toks[j].w[0]) &&
                 /^[ \u00A0]$/.test(text.slice(toks[j].e, toks[j + 1].s))) j++;
          if (j > i) {
            var group = toks.slice(i, j + 1);
            if (group.some(function (t) { return t.strong; })) group.forEach(function (t) { t.keep = true; });
          }
          i = j + 1;
        }
      }
      var edits = [];
      toks.forEach(function (t) {
        if (t.keep) return;
        if (urls.length && inSpans(urls, t.s, t.e)) return;
        var out = fn(t.w);
        if (out !== t.w) edits.push([t.s, t.e, out]);
      });
      return edits;
    }

    function applyEdits(text, edits) {
      for (var k = edits.length - 1; k >= 0; k--) {
        text = text.slice(0, edits[k][0]) + edits[k][2] + text.slice(edits[k][1]);
      }
      return text;
    }

    function wordToCyrillic(word) {
      // Clearly foreign words and Roman numerals stay as is.
      if (opt.keepForeign && isStrongForeign(word)) return word;
      if (!opt.keepForeign && FOREIGN_LETTERS.test(word)) return word;
      if (ROMAN_RE.test(word)) return word;
      var norm = normLatin(word);
      var key = latKey(norm);
      if (skip[key]) return word;
      var pat = casePattern(word);
      var ex = l2c.exact[key];
      if (ex !== undefined) return applyCase(pat, ex);
      for (var len = Math.min(l2c.maxStem, key.length); len >= 3; len--) {
        var st = l2c.stems[key.slice(0, len)];
        if (st !== undefined) {
          var rest = latRules(norm, len);
          var head = pat === "upper" ? st.toUpperCase() : applyCase(isUpper(word[0]) ? "title" : "lower", st);
          return head + rest;
        }
      }
      return latRules(norm, 0);
    }

    function wordToLatin(word) {
      var key = word.toLowerCase();
      if (skip[key]) return word;
      var pat = casePattern(word);
      var ex = c2l.exact[key];
      if (ex !== undefined) return applyCase(pat, fixApos(ex));
      for (var len = Math.min(c2l.maxStem, key.length); len >= 3; len--) {
        var st = c2l.stems[key.slice(0, len)];
        if (st !== undefined) {
          var rest = cyrRules(word, len, opt);
          var head = pat === "upper" ? fixApos(st).toUpperCase() : applyCase(isUpper(word[0]) ? "title" : "lower", fixApos(st));
          return head + rest;
        }
      }
      return cyrRules(word, 0, opt);
    }

    // Exception values use ' / ‘ / ’ loosely; render them with the chosen characters.
    function fixApos(s) {
      var r = "";
      for (var i = 0; i < s.length; i++) {
        var ch = s[i];
        if (APOS_SET[ch]) {
          var p = s[i - 1];
          r += (p === "o" || p === "O" || p === "g" || p === "G") ? opt.okina : opt.tutuq;
        } else r += ch;
      }
      return r;
    }

    return {
      options: opt,
      toCyrillic: function (text) { return applyEdits(text, planEdits(text, "lat")); },
      toLatin: function (text) { return applyEdits(text, planEdits(text, "cyr")); },
      planEdits: planEdits,
      wordToCyrillic: wordToCyrillic,
      wordToLatin: wordToLatin,
      // user additions: pairs [[latin, cyrillic], ...]
      addUserPairs: function (pairs) {
        var a = [], b = [];
        for (var i = 0; i < pairs.length; i++) {
          var lat = pairs[i][0], cyr = pairs[i][1];
          if (!lat || !cyr) continue;
          a.push([latKey(normLatin(lat)), cyr.toLowerCase()]);
          b.push([cyr.toLowerCase(), lat.toLowerCase()]);
        }
        addPairs(l2c, a); addPairs(c2l, b);
      },
      // words never to transliterate (any script)
      addSkipWords: function (words) {
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          if (w) skip[latKey(normLatin(w))] = true, skip[w.toLowerCase()] = true;
        }
      }
    };
  }

  // Links and e-mail addresses are never transliterated.
  var URL_RE = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>«»"“”]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  function urlSpans(text) {
    var spans = [], m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text))) spans.push([m.index, m.index + m[0].length]);
    return spans;
  }
  function inSpans(spans, from, to) {
    for (var i = 0; i < spans.length; i++) if (from < spans[i][1] && to > spans[i][0]) return true;
    return false;
  }


  // Count Latin vs Cyrillic letters to guess the direction.
  function detect(text) {
    var lat = (text.match(/[A-Za-z]/g) || []).length;
    var cyr = (text.match(/[Ѐ-ӿ]/g) || []).length;
    if (!lat && !cyr) return null;
    return cyr > lat ? "cyr" : "lat";
  }

  var api = {
    create: create, detect: detect,
    // fresh global regex matching source-script words: "lat" (Latin words) or "cyr"
    urlSpans: urlSpans, inSpans: inSpans,
    wordRegex: function (script) { return new RegExp((script === "lat" ? LAT_WORD_RE : CYR_WORD_RE).source, "g"); },
    _latRules: latRules, _cyrRules: cyrRules, _normLatin: normLatin };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.UzTranslit = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
