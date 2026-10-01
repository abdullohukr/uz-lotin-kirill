/* global Office, UzTranslit, UzSettings, UzWord */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var settings = UzSettings.load();
  var busy = false;

  function engine() {
    var t = UzTranslit.create(window.UZ_EXCEPTIONS || {}, { okina: settings.okina, tutuq: settings.tutuq });
    t.addUserPairs(settings.userPairs || []);
    t.addSkipWords(settings.skipWords || []);
    return t;
  }

  function fillForm() {
    $("style").value = settings.style;
    $("pairs").value = UzSettings.formatPairs(settings.userPairs || []);
    $("skip").value = (settings.skipWords || []).join("\n");
  }

  function status(msg, isError) {
    $("status").textContent = msg;
    $("status").className = isError ? "error" : "";
  }

  async function run(direction) {
    if (busy) return;
    busy = true;
    var scope = document.querySelector("input[name=scope]:checked").value;
    $("toCyr").disabled = $("toLat").disabled = true;
    $("progress").hidden = false;
    $("bar").style.width = "0%";
    status("O‘giryapmiz…");
    var started = Date.now();
    try {
      var st = await UzWord.convertInWord(direction, scope, settings, function (done, total) {
        $("bar").style.width = Math.round(100 * done / Math.max(total, 1)) + "%";
        status("O‘giryapmiz… " + done + " / " + total + " xatboshi");
      });
      var sec = Math.round((Date.now() - started) / 1000);
      var msg = "Tayyor: " + st.words + " ta so‘z o‘girildi (" +
        (st.scope === "selection" ? "belgilangan matn" : "butun hujjat") + ", " + sec + " s).";
      if (st.extraParas) msg += " DIQQAT: hujjatda " + st.extraParas + " ta ortiqcha xatboshi paydo bo‘ldi — skrinshot yuboring.";
      status(msg + " [ooxml " + st.ooxmlParas + ", oddiy " + st.fallbackParas + "]", !!st.extraParas);
    } catch (e) {
      status("Xato: " + (e && e.message ? e.message : e), true);
    } finally {
      busy = false;
      $("toCyr").disabled = $("toLat").disabled = false;
      setTimeout(function () { $("progress").hidden = true; }, 800);
    }
  }

  function wire() {
    $("ver").textContent = window.UZ_VERSION || "?";
    fillForm();
    $("toCyr").onclick = function () { run("cyr"); };
    $("toLat").onclick = function () { run("lat"); };
    $("tryCyr").onclick = function () { $("tryOut").value = engine().toCyrillic($("tryIn").value); };
    $("tryLat").onclick = function () { $("tryOut").value = engine().toLatin($("tryIn").value); };
    $("save").onclick = function () {
      settings.style = $("style").value;
      settings.userPairs = UzSettings.parsePairs($("pairs").value);
      settings.skipWords = $("skip").value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      UzSettings.save(settings);
      settings = UzSettings.load();
      fillForm();
      $("saved").textContent = "Saqlandi ✓";
      setTimeout(function () { $("saved").textContent = ""; }, 2000);
    };
  }

  // scripts are loaded from <head>, so wait for the page body as well
  function domReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  if (window.Office && Office.onReady) {
    Office.onReady(function (info) { domReady(function () { start(info); }); });
  } else {
    domReady(wire);
  }
  function start(info) {
    wire();
    if (info.host !== Office.HostType.Word) {
      status("Bu panel Word ichida ishlaydi. Pastdagi sinov oynasi brauzerda ham ishlaydi.");
      $("toCyr").disabled = $("toLat").disabled = true;
    }
  }
})();
