/*
 * Builds data/exceptions.json from a word-frequency corpus.
 *
 * Run (macOS, no install needed):
 *   jsc=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
 *   $jsc tools/build_exceptions.js -- <cyr.tsv> <lat.tsv> > data/exceptions.json
 *
 * cyr.tsv / lat.tsv: "word<TAB>frequency" lines (lowercase; Latin apostrophes as ').
 *
 * Idea: Cyrillic -> Latin follows rules almost without exceptions. So for every
 * Cyrillic word we compute its Latin form and convert it back with the rules. If
 * the round trip does not give the original word, the (latin, cyrillic) pair is
 * an exception - provided the Latin form is really used in Latin texts.
 */
load("src/engine.js");

var args = typeof arguments !== "undefined" ? arguments : scriptArgs;
var cyrFile = args[0], latFile = args[1];

function readTsv(path) {
  var m = {};
  var lines = readFile(path).split("\n");
  for (var i = 0; i < lines.length; i++) {
    var p = lines[i].split("\t");
    if (p.length < 2) continue;
    m[p[0]] = (m[p[0]] || 0) + parseInt(p[1], 10);
  }
  return m;
}
function readCsvPairs(path) {
  var out = [];
  var lines = readFile(path).split("\n");
  for (var i = 0; i < lines.length; i++) {
    var p = lines[i].trim().split(",");
    if (p.length === 2 && p[0] && p[1]) out.push(p);
  }
  return out;
}
var isCyr = function (s) { return /^[Ѐ-ӿ]+$/.test(s); };

var CYR = readTsv(cyrFile);
var LAT = readTsv(latFile);

// Hand-made seeds (see data/manual.js): applied first, override corpus.
load("data/manual.js");
var MANUAL = UZ_MANUAL_EXCEPTIONS;

var c2lSeed = { exact: {}, stems: MANUAL.cyr2lat_stems.slice() };
for (var k in MANUAL.cyr2lat_exact) c2lSeed.exact[k] = MANUAL.cyr2lat_exact[k];

// UzTransliterator (MIT) lists: pairs in either order; use them where our rules fail.
var uztPairs = readCsvPairs("tools/cyr_exwords.csv").concat(readCsvPairs("tools/lat_exwords.csv"));
var plain = UzTranslit.create({});
var uztL2C = {};
uztPairs.forEach(function (p) {
  var lat = isCyr(p[0]) ? p[1] : p[0], cyr = isCyr(p[0]) ? p[0] : p[1];
  lat = lat.toLowerCase(); cyr = cyr.toLowerCase();
  if (!isCyr(cyr) || /ь[аиуўэоқ]/.test(cyr)) return;
  if ((CYR[plain.wordToCyrillic(lat).toLowerCase()] || 0) >= 3) return; // rules give a real word
  var key = lat.replace(/[ʻʼ‘’`']/g, "'");
  if (plain.wordToLatin(cyr).toLowerCase().replace(/[ʻʼ‘’`']/g, "'") !== key && !c2lSeed.exact[cyr]) c2lSeed.exact[cyr] = key;
  if (plain.wordToCyrillic(lat).toLowerCase() !== cyr) uztL2C[key] = cyr;
});

var engine = UzTranslit.create({ cyr2lat: c2lSeed });
function toLatKey(cyrWord) {
  return engine.wordToLatin(cyrWord).toLowerCase().replace(/[ʻʼ‘’`']/g, "'");
}
function rulesToCyr(latKey) {
  return plain.wordToCyrillic(latKey).toLowerCase();
}

// ---- 1. candidates from the corpus
var cand = {}; // latKey -> {cyr, f}
var allPairs = []; // [latKey, cyr, f] for every Cyrillic word (used to validate stems)
for (var w in CYR) {
  var f = CYR[w];
  if (!isCyr(w) || /[ыщ]/.test(w) || w.length < 2) continue;
  var key = toLatKey(w);
  allPairs.push([key, w, f]);
  var back = rulesToCyr(key);
  if (back === w) continue;
  var latF = LAT[key] || 0;
  if (/ь[аиуўэоқ]|йу/.test(w)) continue;      // informal spellings (саньат, йул), not real exceptions
  if (!((latF >= 3 && f >= 3) || (latF >= 1 && f >= 15) || f >= 60)) continue; // not attested enough: Russian words / typos
  if (key.length <= 4 && !(f >= 30 && latF >= 5)) continue; // short words: only very well attested
  // rule output is a common word too (soy: сой/Цой) - rules win. For words that differ
  // only by ь (январь/январ, фильм/филм) prefer the dictionary spelling with ь.
  var onlySoft = w.replace(/ь/g, "") === back;
  if ((CYR[back] || 0) > (onlySoft ? f * 3 : f / 2)) continue;
  if (!cand[key] || cand[key].f < f) cand[key] = { cyr: w, f: f, latF: latF };
}
// сҳ words are often written without the apostrophe (ashob, Ishoq, mushaf)
allPairs.forEach(function (p) {
  if (p[1].indexOf("сҳ") < 0) return;
  var bare = p[0].replace(/s'h/g, "sh");
  var shForm = rulesToCyr(bare);
  if ((CYR[shForm] || 0) > 0) return;  // a real word with ш exists - ambiguous
  if ((LAT[bare] || 0) >= 2 && p[2] >= 20) {
    if (!cand[bare] || cand[bare].f < p[2]) cand[bare] = { cyr: p[1], f: p[2], latF: LAT[bare] || 0 };
  }
});
for (var uk in uztL2C) if (!cand[uk]) cand[uk] = { cyr: uztL2C[uk], f: 1, latF: 0 };

// ---- 2. generalise to stems where the whole corpus agrees
allPairs.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
function lowerBound(prefix) {
  var lo = 0, hi = allPairs.length;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (allPairs[mid][0] < prefix) lo = mid + 1; else hi = mid; }
  return lo;
}
function predictWithStem(key, stemLat, stemCyr) {
  // rules for the rest of the word, with the stem as left context
  var restOnly = UzTranslit._latRules(UzTranslit._normLatin(key), stemLat.length).toLowerCase();
  return stemCyr + restOnly;
}
var stems = {};
var exact = {};
var keys = Object.keys(cand).sort(function (a, b) { return a.length - b.length; });
keys.forEach(function (key) {
  var c = cand[key].cyr;
  // already covered by a shorter accepted stem?
  for (var s in stems) {
    if (key.indexOf(s) === 0 && predictWithStem(key, s, stems[s]) === c) return;
  }
  var found = false;
  for (var m = 5; m <= key.length && !found; m++) {
    var sl = key.slice(0, m);
    var restCyr = UzTranslit._latRules(UzTranslit._normLatin(key), m).toLowerCase();
    if (c.length < restCyr.length || c.slice(c.length - restCyr.length) !== restCyr) continue;
    var sc = c.slice(0, c.length - restCyr.length);
    if (!sc || sc === rulesToCyr(sl)) continue; // the stem must itself carry the exception
    // validate across every corpus word that starts with this Latin stem
    var ok = 0, bad = 0, badF = 0, okF = 0;
    for (var i = lowerBound(sl); i < allPairs.length && allPairs[i][0].indexOf(sl) === 0; i++) {
      var pr = predictWithStem(allPairs[i][0], sl, sc);
      if (pr === allPairs[i][1]) { ok++; okF += allPairs[i][2]; } else { bad++; badF += allPairs[i][2]; }
    }
    if (ok >= 3 && okF >= 10 && bad === 0) { stems[sl] = sc; found = true; }
  }
  if (!found) exact[key] = c;
});
// manual Latin->Cyrillic entries win
for (var mk in MANUAL.lat2cyr_exact) exact[mk] = MANUAL.lat2cyr_exact[mk];
MANUAL.lat2cyr_stems.forEach(function (p) { stems[p[0]] = p[1]; });

// drop exact entries that a stem already produces
var exact2 = {};
Object.keys(exact).sort().forEach(function (key) {
  for (var s in stems) if (key.indexOf(s) === 0 && predictWithStem(key, s, stems[s]) === exact[key]) return;
  exact2[key] = exact[key];
});

var stemList = Object.keys(stems).sort().map(function (s) { return [s, stems[s]]; });
var c2lStems = c2lSeed.stems;
var out = {
  _about: "Uzbek Latin<->Cyrillic exceptions. Generated by tools/build_exceptions.js from the Leipzig Uzbek community corpus 2017 (CC BY), UzTransliterator lists (MIT) and data/manual.js.",
  lat2cyr: { exact: exact2, stems: stemList },
  cyr2lat: { exact: c2lSeed.exact, stems: c2lStems }
};
print(JSON.stringify(out));
