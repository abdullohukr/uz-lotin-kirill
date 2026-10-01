// Loads data/exceptions.json together with the foreign-word lists (for jsc scripts).
function loadUzData() {
  var ex = JSON.parse(readFile("data/exceptions.json"));
  ex.foreign = JSON.parse(readFile("data/foreign.json"));
  ex.acronyms = JSON.parse(readFile("data/acronyms.json"));
  return ex;
}
