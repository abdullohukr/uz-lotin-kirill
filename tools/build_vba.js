/*
 * Generates vba/UzLotinKirill.bas (offline Word macro) from the template,
 * data/exceptions.json and self-test cases computed by src/engine.js.
 *
 *   jsc=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
 *   $jsc tools/build_vba.js > vba/UzLotinKirill.bas
 *
 * The .bas file is pure ASCII (VBA editors break on non-ASCII source):
 * Cyrillic dictionary text uses a one-letter ASCII code, test strings use {XXXX}.
 */
load("src/engine.js");

var CYRSET = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяўқғҳ";
var CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@";
function enc(s) {
  var r = "";
  for (var i = 0; i < s.length; i++) {
    var k = CYRSET.indexOf(s[i]);
    if (k < 0 && s.charCodeAt(i) > 127) throw new Error("cannot encode " + JSON.stringify(s));
    r += k >= 0 ? CODES[k] : s[i];
  }
  return r;
}
function uesc(s) {
  var r = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (s[i] === "{" || s[i] === "}") throw new Error("braces in test string");
    r += c > 127 ? "{" + c.toString(16).toUpperCase().padStart(4, "0") + "}" : s[i];
  }
  return r;
}
function str(s) {
  for (var i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) throw new Error("non-ASCII: " + s);
  return '"' + s.replace(/"/g, '""') + '"';
}
function latKey(k) { return k.replace(/'/g, "_"); }

var ex = JSON.parse(readFile("data/exceptions.json"));
var lines = [];
function L2(s) { lines.push(s); }

// ---- data
var stmts = [];
Object.keys(ex.lat2cyr.exact).sort().forEach(function (k) {
  stmts.push("AddLE " + str(latKey(k)) + ", " + str(enc(ex.lat2cyr.exact[k])));
});
ex.lat2cyr.stems.forEach(function (p) {
  stmts.push("AddLS " + str(latKey(p[0])) + ", " + str(enc(p[1])));
});
Object.keys(ex.cyr2lat.exact).sort().forEach(function (k) {
  stmts.push("AddCE " + str(enc(k)) + ", " + str(ex.cyr2lat.exact[k]));
});
ex.cyr2lat.stems.forEach(function (p) {
  stmts.push("AddCS " + str(enc(p[0])) + ", " + str(p[1]));
});

function emitSubs(prefix, list, per) {
  var names = [];
  for (var i = 0; i < list.length; i += per) {
    var name = prefix + (names.length + 1);
    names.push(name);
    L2("Private Sub " + name + "()");
    list.slice(i, i + per).forEach(function (s) { L2("    " + s); });
    L2("End Sub");
    L2("");
  }
  return names;
}

var dataSubs = emitSubs("UzData", stmts, 400);
L2("Private Sub LoadData()");
dataSubs.forEach(function (n) { L2("    " + n); });
L2("End Sub");
L2("");

// ---- self test cases (expected values from the JS engine, default ‘ ’ style)
var t = UzTranslit.create(ex, { okina: "‘", tutuq: "’" });
var tests = [];
function both(lat, cyr) { tests.push([false, lat, t.toCyrillic(lat)]); tests.push([true, cyr, t.toLatin(cyr)]); }
var sentences = [
  "Abu Sufyon roziyallohu anhuning uzun hadisida Hiraql qissasida, Hiraql so‘raganida: «U sizni nimalarga buyuradi?» dedi.",
  "Otam: «Nega «qadr» sindirding», dedi. “Salom” va \"xayr\" o‘zgarmaydi.",
  "O‘ZBEKISTON RESPUBLIKASI Shahar SHAHAR shahar",
  "as’hob Is’hoq mus’haf ashob Ishoq Qur’on ma’no e’lon san’at",
  "yer poyezd yetti ekran poema yo‘l yo‘q Yo‘ldosh ayol ayyom",
  "ketsa yetsa baxtsizlik inflyatsiya konstitutsiya litsey politsiya konsert",
  "obyekt subyekt mo‘jiza mo‘tabar sentabr oktabr sentabrda kompyuter film",
  "Abdullaev Tillaeva Boboevich mikroevolyutsiya soy sur tush tol XX asr XIV",
  "ijmo' istisno' ijmo'ni O'zbekiston bog' ma'no O`zbekiston Microsoft Word 'Salom'",
  "avtomobil avtomobilga albumin aksept Buxoriy 1/30 va Muslim 1773-raqam"
];
sentences.forEach(function (s) {
  tests.push([false, s, t.toCyrillic(s)]);
  var c = t.toCyrillic(s);
  tests.push([true, c, t.toLatin(c)]);
});
// every exception word and stem (with a suffix), both ways
Object.keys(ex.lat2cyr.exact).sort().forEach(function (k, i) {
  if (i % 3) return;
  var w = k.replace(/'/g, "’");
  tests.push([false, w, t.toCyrillic(w)]);
  var c = ex.lat2cyr.exact[k];
  tests.push([true, c, t.toLatin(c)]);
});
ex.lat2cyr.stems.forEach(function (p, i) {
  if (i % 3) return;
  var w = p[0].replace(/'/g, "’") + "lardan";
  tests.push([false, w, t.toCyrillic(w)]);
  var cap = w.charAt(0).toUpperCase() + w.slice(1);
  tests.push([false, cap, t.toCyrillic(cap)]);
});
Object.keys(ex.cyr2lat.exact).forEach(function (k) { tests.push([true, k, t.toLatin(k)]); });

var testStmts = tests.map(function (c) {
  return "T " + (c[0] ? "True" : "False") + ", " + str(uesc(c[1])) + ", " + str(uesc(c[2]));
});
var testSubs = emitSubs("UzTests", testStmts, 300);
L2("Private Sub RunTests()");
testSubs.forEach(function (n) { L2("    " + n); });
L2("End Sub");

var tpl = readFile("vba/UzLotinKirill.template.bas");
var out = tpl.replace("'@@GENERATED@@", lines.join("\n"));
out = out.replace(/\r?\n/g, "\r\n");
for (var i = 0; i < out.length; i++) if (out.charCodeAt(i) > 127) throw new Error("non-ASCII at " + i);
print(out);
