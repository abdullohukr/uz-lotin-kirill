# Third-party data

- `data/exceptions.json` is generated from word frequencies of the Leipzig Corpora Collection
  (Uzbek community 2017, Uzbek Wikipedia 2021), © Leipzig University, CC BY 4.0.
  D. Goldhahn, T. Eckart, U. Quasthoff: *Building Large Monolingual Dictionaries at the Leipzig
  Corpora Collection*, LREC 2012.
- `tools/cyr_exwords.csv`, `tools/lat_exwords.csv` come from
  [UzTransliterator](https://github.com/UlugbekSalaev/UzTransliterator) by Ulugbek Salaev and
  Elmurod Kuriyozov, MIT License.
- `data/savodxon_pairs.tsv`: Latin/Cyrillic word pairs from the Savodxon project
  (savodxon.uz), a free public tool for Uzbek spelling. `[ь]` marks a soft sign used only at the
  end of the word. Each entry is checked against the corpus before use.
