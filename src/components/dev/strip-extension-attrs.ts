/**
 * Dev only. Some browser extensions (Bitdefender TrafficLight stamps `bis_skin_checked` on every element, plus
 * `bis_register` and `__processed_*`) edit the page between the server HTML arriving and React hydrating. React then
 * logs a hydration mismatch for each stamped element, although nothing in the app differs between server and client.
 * This removes those marker attributes before hydration so the console shows only real problems.
 * Rendered from the root layout (next/script `beforeInteractive` must live there), and only when NODE_ENV is not production.
 *
 * It renders nothing in production, touches only attributes with those exact prefixes, and stops watching a few
 * seconds after load, so an extension that keeps re-stamping cannot make it loop.
 */
export const STRIP_EXTENSION_ATTRS = `(function () {
  var PREFIXES = ["bis_", "__processed_"];
  function ours(name) {
    for (var i = 0; i < PREFIXES.length; i++) if (name.indexOf(PREFIXES[i]) === 0) return true;
    return false;
  }
  function clean(el) {
    if (el.nodeType !== 1) return;
    var names = el.getAttributeNames();
    for (var i = 0; i < names.length; i++) if (ours(names[i])) el.removeAttribute(names[i]);
  }
  function sweep(root) {
    clean(root);
    if (root.querySelectorAll) root.querySelectorAll("*").forEach(clean);
  }
  var seen = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === "attributes") { if (r.attributeName && ours(r.attributeName)) r.target.removeAttribute(r.attributeName); }
      else for (var j = 0; j < r.addedNodes.length; j++) sweep(r.addedNodes[j]);
    }
  });
  seen.observe(document, { attributes: true, childList: true, subtree: true });
  sweep(document.documentElement);
  window.addEventListener("load", function () { setTimeout(function () { seen.disconnect(); }, 4000); });
})();`;
