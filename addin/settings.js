/* Settings stored in the add-in's local storage (per computer). */
(function (root) {
  "use strict";
  var KEY = "uzlk.settings.v1";
  var STYLES = {
    typographic: { okina: "‘", tutuq: "’" }, // o‘ ma’no
    unicode: { okina: "ʻ", tutuq: "ʼ" },     // oʻ maʼno
    plain: { okina: "'", tutuq: "'" }                  // o' ma'no
  };

  function defaults() {
    return { style: "typographic", userPairs: [], skipWords: [], keepForeign: true };
  }

  function load() {
    var s = defaults();
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) {
        var v = JSON.parse(raw);
        for (var k in v) s[k] = v[k];
      }
    } catch (e) { /* storage unavailable: use defaults */ }
    var st = STYLES[s.style] || STYLES.typographic;
    s.okina = st.okina;
    s.tutuq = st.tutuq;
    return s;
  }

  function save(s) {
    try {
      root.localStorage.setItem(KEY, JSON.stringify({
        style: s.style, userPairs: s.userPairs, skipWords: s.skipWords, keepForeign: s.keepForeign
      }));
    } catch (e) { /* ignore */ }
  }

  // "latin = кирилл" lines -> [[latin, cyrillic], ...]; one word per line -> skip list
  function parsePairs(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
      var m = line.split("=");
      if (m.length === 2 && m[0].trim() && m[1].trim()) out.push([m[0].trim(), m[1].trim()]);
    });
    return out;
  }
  function formatPairs(pairs) {
    return pairs.map(function (p) { return p[0] + " = " + p[1]; }).join("\n");
  }

  root.UzSettings = { load: load, save: save, parsePairs: parsePairs, formatPairs: formatPairs };
})(typeof globalThis !== "undefined" ? globalThis : this);
