/*
 * Run on macOS without installing anything:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc test/run_tests.js
 * (from the project folder)
 */
load("src/engine.js");
load("tools/load_data.js");
var ex = loadUzData();
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
// foreign names and brands stay Latin
eq("brands in quotes", t.toCyrillic("bozorda «Smarts Vey», «Gold Kvest» va «Seven Daymond» kabi"), "бозорда «Smarts Vey», «Gold Kvest» ва «Seven Daymond» каби");
eq("cadenza", t.toCyrillic("«CADENZAX MUSIC» platformasi, «CadenzaX music» nomli"), "«CADENZAX MUSIC» платформаси, «CadenzaX music» номли");
eq("vip", t.toCyrillic("maxsus «VIP» darajalarni, VIP xizmat"), "махсус «VIP» даражаларни, VIP хизмат");
eq("apple youtube", t.toCyrillic("platformalarida (Apple Music, YouTube va h.k.) eshitilganda"), "платформаларида (Apple Music, YouTube ва ҳ.к.) эшитилганда");
eq("english spelling", t.toCyrillic("Google, Facebook, iPhone, Telegram, online"), "Google, Facebook, iPhone, Telegram, online");
eq("uzbek words that are english too", t.toCyrillic("men ham sport internet son top mana film massa proton Napoleon"), "мен ҳам спорт интернет сон топ мана фильм масса протон Наполеон");
eq("uzbek quote stays converted", t.toCyrillic("«Sahihi Buxoriy» va «Ixlos» surasi"), "«Саҳиҳи Бухорий» ва «Ихлос» сураси");
eq("surah names and quotations", t.toCyrillic("«Nun» surasi, «Hud» surasi. «Yusha’ ibn Nun tirik edi yoki Bani Isroil payg‘ambarlaridan Ilyos kabilar tirik edi»"), "«Нун» сураси, «Ҳуд» сураси. «Юшаъ ибн Нун тирик эди ёки Бани Исроил пайғамбарларидан Илёс кабилар тирик эди»");
eq("brands", t.toCyrillic("Visa, Mastercard va American Express kartalari; Toyota Camry, Chevrolet Malibu, Kia Rio; Turkish Airlines va Uzbekistan Airways; Kun.uz saytida"),
  "Visa, Mastercard ва American Express карталари; Toyota Camry, Chevrolet Malibu, Kia Rio; Turkish Airlines ва Uzbekistan Airways; Kun.uz сайтида");
eq("uzbek words named like brands", t.toCyrillic("Humo qushi, Mars sayyorasi, uzum, ravon, Astana shahri, Rio shahri, kun bo‘yi, BMW va GAZ ta’minoti"),
  "Ҳумо қуши, Марс сайёраси, узум, равон, Астана шаҳри, Рио шаҳри, кун бўйи, BMW ва ГАЗ таъминоти");
eq("initials and roman", t.toCyrillic("M. Yusuf, L. Tolstoy, I. Karimov; XX asr, V asr, I jild"), "М. Юсуф, Л. Толстой, И. Каримов; XX аср, V аср, I жилд");
eq("ip is a word", t.toCyrillic("ip va igna, IP manzil, teleekranda"), "ип ва игна, IP манзил, телеэкранда");
eq("accented names", t.toCyrillic("Ülker va Müller, Citroën"), "Ülker ва Müller, Citroën");
eq("bee'tibor", t.toCyrillic("bee’tibor, QR kod"), "беэътибор, ҚР код");
eq("sath inshoot", t.toCyrillic("yer sathi, inshootlar, Movarounnahr"), "ер сатҳи, иншоотлар, Мовароуннаҳр");
eq("urls stay", t.toCyrillic("Link: https://islamqa.info/ar/answers/332928 va www.savodxon.uz, ism.familiya@example.com yozing"), "Линк: https://islamqa.info/ar/answers/332928 ва www.savodxon.uz, ism.familiya@example.com ёзинг");
eq("savodxon stems", t.toCyrillic("avtomobil avtomobilga albumin aksept"), "автомобиль автомобилга альбумин акцепт");
eq("uzbek words keep no ь", t.toCyrillic("tush tol mil"), "туш тол мил");
eq("passport surnames", t.toCyrillic("Abdullaev Tillaeva Boboevich"), "Абдуллаев Тиллаева Бобоевич");
eq("ijmo'", t.toCyrillic("ijmo' istisno'"), "ижмоъ истисноъ");
eq("ijmo'ni", t.toCyrillic("ijmo'ni"), "ижмоъни");
eq("bare ashob", t.toCyrillic("ashob Ishoq"), "асҳоб Исҳоқ");
eq("straight apostrophes", t.toCyrillic("O'zbekiston bog' ma'no"), "Ўзбекистон боғ маъно");
eq("backtick apostrophes", t.toCyrillic("O`zbekiston"), "Ўзбекистон");
eq("foreign words stay", t.toCyrillic("Microsoft Word va WhatsApp"), "Microsoft Word ва WhatsApp");
eq("final ayn", t.toCyrillic("Yusha’ va shay’ ‘Salom’ dedi"), "Юшаъ ва шайъ ‘Салом’ деди");
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
