/*
 * Hand-made exceptions. They override the corpus-generated list.
 * Latin keys: lowercase, every apostrophe written as '.
 * "stems" match the beginning of a word; the rest follows the normal rules
 * (ijmo'ni -> ижмоъни, sentabrda -> сентябрда).
 */
var UZ_MANUAL_EXCEPTIONS = {
  // Latin -> Cyrillic
  lat2cyr_exact: {
    // ц words that are also other words with с (sirka = сирка), so whole words only
    "sirk": "цирк", "sirkda": "циркда", "sirkka": "циркка", "sirkni": "циркни", "sirkning": "циркнинг",
    "sex": "цех", "sexda": "цехда", "sexga": "цехга", "sexi": "цехи", "sexni": "цехни", "sexlar": "цехлар",
    // months: dictionary spelling with ь; with suffixes ь is dropped (сентябрда)
    "yanvar": "январь", "fevral": "февраль", "aprel": "апрель", "iyun": "июнь", "iyul": "июль",
    "sentabr": "сентябрь", "oktabr": "октябрь", "noyabr": "ноябрь", "dekabr": "декабрь",
    "nol": "ноль", "noldan": "нолдан", "nolga": "нолга",
    // сҳ written without the apostrophe
    "ishoq": "исҳоқ", "ashob": "асҳоб", "ashobi": "асҳоби", "ashoblari": "асҳоблари", "ashoblar": "асҳоблар",
    "mushaf": "мусҳаф", "mushafi": "мусҳафи", "mushafni": "мусҳафни", "mushafda": "мусҳафда", "mushaflar": "мусҳафлар"
  },
  lat2cyr_stems: [
    // o + ayn (оъ), written o' in Latin just like o‘
    ["ijmo'", "ижмоъ"],
    ["istisno'", "истисноъ"],
    ["qino'", "қиноъ"],
    ["sentabr", "сентябр"],
    ["oktabr", "октябр"]
  ],
  // Cyrillic -> Latin
  cyr2lat_exact: {},
  cyr2lat_stems: [
    ["сентябр", "sentabr"],
    ["октябр", "oktabr"]
  ]
};
