/*
 * English words that must stay in Latin inside Uzbek text (Apple, online, Seven...).
 *
 *   $jsc tools/build_foreign.js -- <cyr.tsv> <lat.tsv> [<all-cyrillic.tsv>] > data/foreign.json
 *
 * all-cyrillic.tsv may include Russian text: scientific words (генератор,
 * интеграл, протон) are written in Cyrillic there, brand names letter by
 * letter (аппле, гоогле) are not.
 *
 * Source: tools/en_50k.txt (FrequencyWords by Hermit Dave, MIT; OpenSubtitles 2018).
 * A word is kept Latin only when Uzbek Cyrillic texts do NOT write its
 * letter-by-letter transliteration (спорт, интернет, ҳам, мен are written, so
 * sport/internet/ham/men are converted as usual).
 */
load("src/engine.js");
var args = typeof arguments !== "undefined" ? arguments : scriptArgs;
function readTsv(path) {
  var m = {};
  readFile(path).split("\n").forEach(function (l) { var p = l.split("\t"); if (p.length > 1) m[p[0]] = +p[1]; });
  return m;
}
var CYR = readTsv(args[0]), LAT = readTsv(args[1]);
if (args[2]) { var ALL = readTsv(args[2]); for (var k in ALL) CYR[k] = (CYR[k] || 0) + ALL[k]; }
var ex = JSON.parse(readFile("data/exceptions.json"));
var plain = UzTranslit.create({});
var out = [], risky = [];
readFile("tools/en_50k.txt").split("\n").slice(0, 30000).forEach(function (l) {
  var w = l.split(" ")[0];
  if (!/^[a-z]{3,}$/.test(w)) return;
  if (/w|c(?!h)/.test(w)) return;                 // already foreign by letters
  if (ex.lat2cyr.exact[w]) return;                // a known Uzbek word
  var cyr = plain.wordToCyrillic(w);
  if ((CYR[cyr] || 0) >= 3) return;               // Uzbek Cyrillic texts write it
  out.push(w);
  if ((LAT[w] || 0) >= 50) risky.push(w + ":" + LAT[w]);
});
if (typeof debug === "function") debug("foreign " + out.length + "; frequent in Uzbek Latin texts: " + risky.join(" "));
print(JSON.stringify(out.sort()));
