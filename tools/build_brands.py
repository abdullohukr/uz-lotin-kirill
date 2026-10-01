"""data/brands.txt -> data/brands.json for the engine.

words:   {"toyota": "cap", "bmw": "caps", "vivo": "exact:vivo"}
         cap   - kept when written with a capital letter (Toyota, TOYOTA)
         caps  - kept only in capitals (BMW, DAF): short names that could be words
         exact - kept only exactly as listed (vivo, realme, UzA, eBay)
phrases: [["american", "express"], ["turkish", "airlines"], ...]
         all words must follow each other (space, "-", ".", "&" between them)
Entries with letters outside A-Z (Citroën, Ülker) are skipped: words with such
letters always stay Latin anyway.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "data", "brands.txt")
OUT = os.path.join(HERE, "..", "data", "brands.json")
TOKEN = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")

words, phrases = {}, []
for line in open(SRC, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    if re.search(r"[^\x00-\x7f’]", line):
        continue
    toks = TOKEN.findall(line)
    toks = [t.replace("’", "'") for t in toks]
    if not toks or all(len(t) == 1 for t in toks):
        continue
    if len(toks) == 1:
        t = toks[0]
        if len(t) < 2:
            continue
        if t.isupper():
            mode = "caps"
        elif any(ch.isupper() for ch in t[1:]):
            mode = "exact:" + t      # UzA, iPhone, eBay: only this spelling
        elif t[0].isupper():
            mode = "cap"
        else:
            mode = "exact:" + t
        key = t.lower()
        old = words.get(key)
        # "cap" covers "caps"; keep the most general mode
        if old is None or old.startswith("exact") or (old == "caps" and mode == "cap"):
            words[key] = mode
    else:
        p = [t.lower() for t in toks]
        if p not in phrases:
            phrases.append(p)

json.dump({"words": words, "phrases": phrases}, open(OUT, "w"), ensure_ascii=False, indent=0)
print(f"brands: {len(words)} words, {len(phrases)} phrases")
