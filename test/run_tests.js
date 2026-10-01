/*
 * Run on macOS without installing anything:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc test/run_tests.js
 * (from the project folder)
 */
load("src/engine.js");
var ex = JSON.parse(readFile("data/exceptions.json"));
var t = UzTranslit.create(ex);

var fails = 0, n = 0;
function eq(name, got, want) {
  n++;
  if (got !== want) { fails++; print("FAIL " + name + "\n  got:  " + got + "\n  want: " + want); }
}

// [latin, cyrillic] - must convert both ways
var both = [
  ["Abu Sufyon roziyallohu anhu", "Абу Суфён розияллоҳу анҳу"],
  ["«U sizni nimalarga buyuradi?» dedi.", "«У сизни нималарга буюради?» деди."],
  ["“Salom” va \"xayr\" – qo‘shtirnoqlar o‘zgarmaydi", "“Салом” ва \"хайр\" – қўштирноқлар ўзгармайди"],
  ["Yolg‘iz Allohga ibodat qilinglar", "Ёлғиз Аллоҳга ибодат қилинглар"],
  ["rostgo‘ylikka, iffatga va silai rahmga", "ростгўйликка, иффатга ва силаи раҳмга"],
  ["Buxoriy 1/30 va Muslim 1773-raqam", "Бухорий 1/30 ва Муслим 1773-рақам"],
  ["O‘ZBEKISTON RESPUBLIKASI", "ЎЗБЕКИСТОН РЕСПУБЛИКАСИ"],
  ["Shahar SHAHAR shahar", "Шаҳар ШАҲАР шаҳар"],
  ["as’hob Is’hoq mus’haf", "асҳоб Исҳоқ мусҳаф"],
  ["Qur’on ma’no e’lon san’at", "Қуръон маъно эълон санъат"],
  ["yer poyezd yetti ekran poema", "ер поезд етти экран поэма"],
  ["yo‘l yo‘q Yo‘ldosh", "йўл йўқ Йўлдош"],
  ["ketsa yetsa baxtsizlik", "кетса етса бахтсизлик"],
  ["inflyatsiya konstitutsiya", "инфляция конституция"],
  ["litsey politsiya konsert", "лицей полиция концерт"],
  ["obyekt subyekt", "объект субъект"],
  ["mo‘jiza", "мўъжиза"],
  ["sentabr oktabr sentabrda", "сентябрь октябрь сентябрда"],
  ["kompyuter film", "компьютер фильм"],
  ["ayol ayyom qiyomat", "аёл айём қиёмат"],
  ["soy sur", "сой сур"],
  ["XX asr", "XX аср"],
  ["Abdullayev Tillayeva Boboyevich mikroevolyutsiya", "Абдуллаев Тиллаева Бобоевич микроэволюция"],
  ["mo‘tabar mo‘tadil mo‘jaz", "мўътабар мўътадил мўъжаз"]
];
both.forEach(function (p) {
  eq("lat->cyr: " + p[0], t.toCyrillic(p[0]), p[1]);
  eq("cyr->lat: " + p[1], t.toLatin(p[1]), p[0]);
});

// one direction only
eq("passport surnames", t.toCyrillic("Abdullaev Tillaeva Boboevich"), "Абдуллаев Тиллаева Бобоевич");
eq("ijmo'", t.toCyrillic("ijmo' istisno'"), "ижмоъ истисноъ");
eq("ijmo'ni", t.toCyrillic("ijmo'ni"), "ижмоъни");
eq("bare ashob", t.toCyrillic("ashob Ishoq"), "асҳоб Исҳоқ");
eq("straight apostrophes", t.toCyrillic("O'zbekiston bog' ma'no"), "Ўзбекистон боғ маъно");
eq("backtick apostrophes", t.toCyrillic("O`zbekiston"), "Ўзбекистон");
eq("foreign words stay", t.toCyrillic("Microsoft Word va WhatsApp"), "Microsoft Word ва WhatsApp");
eq("single quotes stay", t.toCyrillic("'Salom'"), "'Салом'");
eq("cyr circus", t.toLatin("цирк лицей Цой"), "sirk litsey Soy");
eq("hyphen", t.toCyrillic("Abu-Dabi"), "Абу-Даби");
eq("no Ab-u bug", t.toLatin("Абу Абу-Бакр"), "Abu Abu-Bakr");

// apostrophe style option
var t2 = UzTranslit.create(ex, { okina: "ʻ", tutuq: "ʼ" });
eq("okina option", t2.toLatin("Ўзбекистон маъно"), "Oʻzbekiston maʼno");

// user dictionary
var t3 = UzTranslit.create(ex);
t3.addUserPairs([["Hiraql", "Ҳирақл"], ["Rasululloh", "Расулуллоҳ"], ["Bilol", "Билол"]]);
t3.addSkipWords(["iPhone"]);
eq("user pair", t3.toCyrillic("Hiraql"), "Ҳирақл");
eq("skip word", t3.toCyrillic("iPhone"), "iPhone");

// quotes are never touched, including nested ones
eq("nested quotes", t.toCyrillic("Otam: «Nega «qadr» sindirding», dedi"), "Отам: «Нега «қадр» синдирдинг», деди");
eq("nested quotes back", t.toLatin("Отам: «Нега «қадр» синдирдинг», деди"), "Otam: «Nega «qadr» sindirding», dedi");
eq("all quote kinds", t.toLatin("«а» “б” „в“ \"г\" ‹д› 'е'"), "«a» “b” „v“ \"g\" ‹d› 'ye'");

print((n - fails) + "/" + n + " passed");
