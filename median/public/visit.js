/*
 * Median — „de la ultima vizită”, fără server: ține minte în browser (localStorage) când ai fost
 * ultima dată pe site și ce subiecte ai deschis, apoi marchează ce e nou. Nimic nu pleacă din browser.
 */
(function () {
  var KEY = "median-vizita";
  var SEEN = "median-vazute";
  var GAP = 30 * 60 * 1000; // o vizită nouă începe după 30 de minute de pauză

  function read(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k) || "null") || d;
    } catch (e) {
      return d;
    }
  }
  function write(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 60) return "acum " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return h === 1 ? "acum o oră" : "acum " + h + " ore";
    var d = Math.round(h / 24);
    return d === 1 ? "ieri" : "acum " + d + " zile";
  }
  function fill(box, n, when) {
    if (!box) return;
    var a = box.querySelector("[data-n]");
    var b = box.querySelector("[data-when]");
    if (a) a.textContent = n;
    if (b) b.textContent = ago(when);
    box.hidden = false;
  }

  // Momentul de referință al vizitei curente (se păstrează cât timp navighezi fără pauze lungi).
  var now = Date.now();
  var v = read(KEY, {});
  if (!v.last || now - v.last > GAP) v.prev = v.last || 0;
  v.last = now;
  write(KEY, v);

  function mark() {
    var prev = v.prev || 0;
    var n = 0;
    if (prev) {
      var els = document.querySelectorAll("[data-ts]");
      for (var i = 0; i < els.length; i++) {
        if (Number(els[i].getAttribute("data-ts")) > prev) {
          els[i].setAttribute("data-nou", "");
          n++;
        } else els[i].removeAttribute("data-nou");
      }
      if (n) fill(document.getElementById("de-la-ultima"), n, prev);
    }
    // Pagina unui subiect: relatările apărute de la ultima deschidere a acestui subiect.
    var main = document.querySelector("[data-story]");
    if (main) {
      var id = main.getAttribute("data-story");
      var seen = read(SEEN, {});
      var last = seen[id];
      if (last) {
        var rows = document.querySelectorAll("[data-ts-item]");
        var k = 0;
        for (var j = 0; j < rows.length; j++) {
          if (Number(rows[j].getAttribute("data-ts-item")) > last) {
            rows[j].setAttribute("data-nou", "");
            k++;
          }
        }
        if (k) fill(document.getElementById("nou-subiect"), k === 1 ? "O relatare nouă" : k + " relatări noi", last);
      }
      seen[id] = Date.now();
      var ids = Object.keys(seen);
      if (ids.length > 300) {
        ids.sort(function (a, b) {
          return seen[a] - seen[b];
        });
        for (var x = 0; x < ids.length - 300; x++) delete seen[ids[x]];
      }
      write(SEEN, seen);
    }
  }
  window.medianMark = mark;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mark);
  else mark();
})();
