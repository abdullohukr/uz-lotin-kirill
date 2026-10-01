/* Ribbon buttons: convert the selection, or the whole document when nothing is selected. */
/* global Office, UzSettings, UzWord */
(function () {
  "use strict";

  function make(direction) {
    return async function (event) {
      try {
        await UzWord.convertInWord(direction, "auto", UzSettings.load());
      } catch (e) {
        if (window.console) console.error(e);
      }
      event.completed();
    };
  }

  var toCyrillic = make("cyr");
  var toLatin = make("lat");
  // names used in manifest.xml (<FunctionName>)
  window.uzToCyrillic = toCyrillic;
  window.uzToLatin = toLatin;

  Office.onReady(function () {
    if (Office.actions && Office.actions.associate) {
      Office.actions.associate("uzToCyrillic", toCyrillic);
      Office.actions.associate("uzToLatin", toLatin);
    }
  });
})();
