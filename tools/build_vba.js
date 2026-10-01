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
load("tools/load_data.js");

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

var ex = loadUzData();
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
// keep-Latin words and English words (packed, one call per ~90 words)
var packed = [];
packed.push("AddAcr " + str((ex.acronyms || []).join(" ")));
var fw = ex.foreign || [];
for (var fi = 0; fi < fw.length; fi += 90) packed.push("AddWeak " + str(fw.slice(fi, fi + 90).join(" ")));
// brands: "key=mode" items and phrases (apostrophes in keys as "_", like BrandKey)
var bw = Object.keys((ex.brands || {}).words || {}).sort().map(function (k) {
  return k.replace(/'/g, "_") + "=" + ex.brands.words[k];
});
for (var bi = 0; bi < bw.length; bi += 60) packed.push("AddBrand " + str(bw.slice(bi, bi + 60).join(" ")));
var bp = ((ex.brands || {}).phrases || []).map(function (p) { return p.map(function (x) { return x.replace(/'/g, "_"); }).join(" "); });
for (var pi = 0; pi < bp.length; pi += 40) packed.push("AddPhrase " + str(bp.slice(pi, pi + 40).join("|")));
dataSubs = dataSubs.concat(emitSubs("UzForeign", packed, 60));
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
  "avtomobil avtomobilga albumin aksept Buxoriy 1/30 va Muslim 1773-raqam",
  "Link: https://islamqa.info/ar/answers/332928 va www.savodxon.uz, ism.familiya@example.com yozing",
  "bozorda «Smarts Vey», «Gold Kvest» va «Seven Daymond» kabi, «CADENZAX MUSIC», «CadenzaX music», maxsus «VIP» darajalar",
  "platformalarida (Apple Music, YouTube va h.k.) Google, Facebook, iPhone, Telegram, online",
  "men ham sport internet son top mana film massa proton Napoleon bee’tibor, QR kod, yer sathi, inshootlar",
  "«Nun» surasi, «Hud» surasi. «Yusha’ ibn Nun tirik edi yoki Bani Isroil payg‘ambarlaridan Ilyos kabilar tirik edi»",
  "Yusha’ va shay’ ‘Salom’ dedi",
  "Visa, Mastercard va American Express kartalari; Toyota Camry, Chevrolet Malibu, Kia Rio; Turkish Airlines va Uzbekistan Airways; Kun.uz saytida",
  "Humo qushi, Mars sayyorasi, uzum, ravon, Astana shahri, Rio shahri, kun bo‘yi, BMW va GAZ ta’minoti",
  "M. Yusuf, L. Tolstoy, I. Karimov; XX asr, V asr, I jild; ip va igna, IP manzil, teleekranda"
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
