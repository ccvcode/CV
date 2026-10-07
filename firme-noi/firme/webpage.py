"""Generator de pagină web (dashboard) peste baza de date de firme.

Produce un fișier HTML autonom (fără server, fără dependențe) cu datele
încorporate ca JSON. Pagina are: carduri de sumar, căutare, filtre (județ,
secțiune CAEN, telefon) și un tabel sortabil. Se poate deschide direct în
browser (dublu-click) sau publica.

    python run.py page --out export/index.html
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from typing import Iterable

from .caen import _SECTIONS
from .models import Company

_SECTION_NAMES = {letter: name for _, _, letter, name in _SECTIONS}

# Câmpurile trimise în pagină.
_FIELDS = [
    "cui", "denumire", "nr_reg_com", "judet", "localitate", "telefon",
    "telefon_sursa", "email", "website", "cod_caen", "caen_descriere",
    "caen_sectiune", "caen_sectiune_nume", "stare_inregistrare",
    "data_inregistrare", "platitor_tva", "adresa",
]

FONT_LINK = (
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
    "family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap\">"
)

STYLE = """
:root{
  --bg:#f4f6f4; --surface:#ffffff; --surface-2:#eef1ee;
  --ink:#18211d; --muted:#5c6b64; --border:#e0e5e0;
  --accent:#0f6e5c; --accent-ink:#ffffff; --accent-weak:#e2f0ec;
  --good:#2e7d32; --warn:#9a5a00; --danger:#b4231f;
  --shadow:0 1px 2px rgba(24,33,29,.06),0 4px 16px rgba(24,33,29,.05);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0f1512; --surface:#171e1a; --surface-2:#1e2620;
  --ink:#e8ede9; --muted:#9aa9a1; --border:#28322c;
  --accent:#40bfa3; --accent-ink:#08130f; --accent-weak:#173029;
  --good:#5fce68; --warn:#e3a44d; --danger:#f0857f;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.28);
  color-scheme:dark;
}}
:root[data-theme="dark"]{
  --bg:#0f1512; --surface:#171e1a; --surface-2:#1e2620;
  --ink:#e8ede9; --muted:#9aa9a1; --border:#28322c;
  --accent:#40bfa3; --accent-ink:#08130f; --accent-weak:#173029;
  --good:#5fce68; --warn:#e3a44d; --danger:#f0857f;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.28);
  color-scheme:dark;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"IBM Plex Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  line-height:1.5;-webkit-font-smoothing:antialiased}
.mono{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  font-variant-numeric:tabular-nums}
.wrap{max-width:1120px;margin:0 auto;padding-block:20px 56px}
.gut{padding-inline:16px}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding-block:14px}
h1{font-size:1.4rem;font-weight:700;margin:0;letter-spacing:-.01em;text-wrap:balance}
.sub{color:var(--muted);font-size:.9rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;
  padding:14px 16px;box-shadow:var(--shadow)}
.tile .n{font-size:1.7rem;font-weight:700;letter-spacing:-.02em}
.tile .l{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
.note{margin-top:14px;font-size:.86rem;color:var(--muted);background:var(--surface-2);
  border:1px solid var(--border);border-left:3px solid var(--warn);border-radius:8px;padding:9px 12px}
.controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0 8px}
input[type=search],select{font:inherit;color:var(--ink);background:var(--surface);
  border:1px solid var(--border);border-radius:9px;padding:9px 11px}
input[type=search]{flex:1 1 240px;min-width:0}
input[type=search]:focus,select:focus{outline:2px solid var(--accent);outline-offset:1px}
.count{color:var(--muted);font-size:.88rem;margin:6px 2px}
.tablewrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow)}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap;vertical-align:top}
th{position:sticky;top:0;background:var(--surface-2);font-weight:600;font-size:.8rem;
  text-transform:uppercase;letter-spacing:.04em;cursor:pointer;user-select:none}
th .ar{color:var(--accent);font-size:.7rem}
td.wide{white-space:normal;min-width:220px}
tr:last-child td{border-bottom:none}
tbody tr:hover{background:var(--accent-weak)}
.name{font-weight:600}
.caen-desc{color:var(--muted);font-size:.82rem;white-space:normal;max-width:280px}
.pill{display:inline-block;font-size:.74rem;font-weight:600;padding:2px 8px;border-radius:999px;
  border:1px solid transparent}
.pill.ok{background:var(--accent-weak);color:var(--accent);border-color:color-mix(in srgb,var(--accent) 30%,transparent)}
.pill.mut{background:var(--surface-2);color:var(--muted);border-color:var(--border)}
.pill.tva{background:color-mix(in srgb,var(--good) 16%,transparent);color:var(--good)}
.pill.rad{background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)}
a.tel{color:var(--ink);text-decoration:none;font-weight:600}
.tel.none{color:var(--muted);font-weight:400}
.empty{padding:40px 16px;text-align:center;color:var(--muted)}
.btn{font:inherit;font-weight:600;color:var(--accent-ink);background:var(--accent);border:none;
  border-radius:9px;padding:9px 14px;cursor:pointer}
.btn:hover{filter:brightness(1.05)}
footer{margin-top:26px;color:var(--muted);font-size:.82rem;text-align:center}
@media (max-width:560px){h1{font-size:1.2rem}.tile .n{font-size:1.4rem}}
"""


def _payload(companies: Iterable[Company]) -> list[dict]:
    rows = []
    for c in companies:
        row = c.to_row()
        rows.append({k: row.get(k) for k in _FIELDS})
    return rows


def _script(companies: Iterable[Company], generat: str) -> str:
    data = _payload(companies)
    data_json = json.dumps(data, ensure_ascii=False)
    names_json = json.dumps(_SECTION_NAMES, ensure_ascii=False)
    return f"""
<script>
const DATA = {data_json};
const SECTION_NAMES = {names_json};
const GENERAT = {json.dumps(generat)};
</script>
<script>
const $ = (s)=>document.querySelector(s);
const state = {{q:"", judet:"", sectiune:"", tel:"", sort:"denumire", dir:1}};

function fmtTel(t){{ return t ? t : "—"; }}
function esc(s){{ return (s==null?"":String(s)); }}

function passes(r){{
  if(state.judet && (r.judet||"")!==state.judet) return false;
  if(state.sectiune && (r.caen_sectiune||"")!==state.sectiune) return false;
  if(state.tel==="da" && !r.telefon) return false;
  if(state.tel==="nu" && r.telefon) return false;
  if(state.q){{
    const q=state.q.toLowerCase();
    const hay=[r.denumire,r.cui,r.localitate,r.judet,r.cod_caen,r.caen_descriere]
      .map(x=>String(x==null?"":x).toLowerCase()).join(" ");
    if(!hay.includes(q)) return false;
  }}
  return true;
}}

function sortRows(rows){{
  const k=state.sort, d=state.dir;
  return rows.slice().sort((a,b)=>{{
    let x=a[k], y=b[k];
    if(k==="cui"||k==="numar_salariati"){{x=+x||0;y=+y||0;return (x-y)*d;}}
    x=String(x==null?"":x).toLowerCase(); y=String(y==null?"":y).toLowerCase();
    return x<y?-1*d : x>y?1*d : 0;
  }});
}}

function render(){{
  const rows = sortRows(DATA.filter(passes));
  $("#count").textContent = rows.length + " firme afișate din " + DATA.length;
  const tb = $("#rows");
  if(!rows.length){{ tb.innerHTML = ""; $("#empty").hidden=false; return; }}
  $("#empty").hidden=true;
  tb.innerHTML = rows.map(r=>{{
    const tva = r.platitor_tva===1||r.platitor_tva===true
      ? '<span class="pill tva">TVA</span>'
      : (r.platitor_tva===0||r.platitor_tva===false ? '<span class="pill mut">fără TVA</span>' : '');
    const radiat = /RADIAT/i.test(r.stare_inregistrare||"") ? '<span class="pill rad">radiată</span>' : '';
    const tel = r.telefon
      ? '<span class="mono tel">'+esc(r.telefon)+'</span>'
      : '<span class="tel none">—</span>';
    const caen = r.cod_caen
      ? '<span class="mono">'+esc(r.cod_caen)+'</span><div class="caen-desc">'+esc(r.caen_descriere||"")+'</div>'
      : '—';
    const loc = [r.localitate, r.judet].filter(Boolean).join(', ');
    return '<tr>'
      + '<td class="wide"><span class="name">'+esc(r.denumire||"—")+'</span>'
        + (r.nr_reg_com?'<div class="caen-desc mono">'+esc(r.nr_reg_com)+'</div>':'')+'</td>'
      + '<td class="mono">'+esc(r.cui)+'</td>'
      + '<td>'+esc(loc||"—")+'</td>'
      + '<td>'+tel+'</td>'
      + '<td>'+caen+'</td>'
      + '<td class="mono">'+esc(r.data_inregistrare||"—")+'</td>'
      + '<td>'+tva+' '+radiat+'</td>'
      + '</tr>';
  }}).join("");
}}

function buildFilters(){{
  const judete=[...new Set(DATA.map(r=>r.judet).filter(Boolean))].sort();
  const secs=[...new Set(DATA.map(r=>r.caen_sectiune).filter(Boolean))].sort();
  $("#f-judet").innerHTML = '<option value="">Toate județele</option>'
    + judete.map(j=>'<option>'+j+'</option>').join("");
  $("#f-sectiune").innerHTML = '<option value="">Toate domeniile</option>'
    + secs.map(s=>'<option value="'+s+'">'+s+' — '+(SECTION_NAMES[s]||s)+'</option>').join("");
}}

function tiles(){{
  const n=DATA.length;
  const tel=DATA.filter(r=>r.telefon).length;
  const tva=DATA.filter(r=>r.platitor_tva===1||r.platitor_tva===true).length;
  const jud=new Set(DATA.map(r=>r.judet).filter(Boolean)).size;
  const sec=new Set(DATA.map(r=>r.caen_sectiune).filter(Boolean)).size;
  const pct=n?Math.round(100*tel/n):0;
  const set=(id,v)=>$(id).textContent=v;
  set("#t-total",n); set("#t-tel",tel+" · "+pct+"%"); set("#t-tva",tva);
  set("#t-jud",jud); set("#t-sec",sec);
}}

document.addEventListener("DOMContentLoaded",()=>{{
  buildFilters(); tiles();
  $("#q").addEventListener("input",e=>{{state.q=e.target.value.trim();render();}});
  $("#f-judet").addEventListener("change",e=>{{state.judet=e.target.value;render();}});
  $("#f-sectiune").addEventListener("change",e=>{{state.sectiune=e.target.value;render();}});
  $("#f-tel").addEventListener("change",e=>{{state.tel=e.target.value;render();}});
  document.querySelectorAll("th[data-k]").forEach(th=>{{
    th.addEventListener("click",()=>{{
      const k=th.dataset.k;
      state.dir = (state.sort===k)? -state.dir : 1;
      state.sort=k;
      document.querySelectorAll("th .ar").forEach(a=>a.textContent="");
      th.querySelector(".ar").textContent = state.dir>0?"▲":"▼";
      render();
    }});
  }});
  $("#gen").textContent = GENERAT;
  render();
}});
</script>
"""


def _body(companies, meta: dict) -> str:
    perioada = html.escape(meta.get("perioada", ""))
    return f"""
<header class="top">
  <div class="wrap gut" style="padding-block:0">
    <div class="brand">
      <h1>Firme Noi România</h1>
      <span class="sub">Bază de date firme nou înființate{(' · ' + perioada) if perioada else ''}</span>
    </div>
  </div>
</header>
<main class="wrap gut">
  <section class="tiles">
    <div class="tile"><div class="n" id="t-total">0</div><div class="l">Firme</div></div>
    <div class="tile"><div class="n" id="t-tel">0</div><div class="l">Cu telefon</div></div>
    <div class="tile"><div class="n" id="t-tva">0</div><div class="l">Plătitori TVA</div></div>
    <div class="tile"><div class="n" id="t-jud">0</div><div class="l">Județe</div></div>
    <div class="tile"><div class="n" id="t-sec">0</div><div class="l">Domenii CAEN</div></div>
  </section>

  <p class="note">Telefoanele importate nu sunt încă confruntate cu ANAF. Rulează
  <span class="mono">python run.py verify</span> pentru validare oficială.</p>

  <div class="controls">
    <input type="search" id="q" placeholder="Caută denumire, CUI, localitate, CAEN…">
    <select id="f-judet"></select>
    <select id="f-sectiune"></select>
    <select id="f-tel">
      <option value="">Telefon: toate</option>
      <option value="da">Doar cu telefon</option>
      <option value="nu">Doar fără telefon</option>
    </select>
  </div>
  <div class="count" id="count"></div>

  <div class="tablewrap">
    <table>
      <thead><tr>
        <th data-k="denumire">Denumire <span class="ar">▲</span></th>
        <th data-k="cui">CUI <span class="ar"></span></th>
        <th data-k="judet">Localitate <span class="ar"></span></th>
        <th data-k="telefon">Telefon <span class="ar"></span></th>
        <th data-k="cod_caen">Activitate (CAEN) <span class="ar"></span></th>
        <th data-k="data_inregistrare">Înreg. <span class="ar"></span></th>
        <th>Stare</th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <div class="empty" id="empty" hidden>Nicio firmă nu corespunde filtrelor.</div>
  </div>

  <footer>Generat la <span id="gen"></span> · date din sursele ONRC + ANAF · uz intern</footer>
</main>
"""


def _meta(companies) -> dict:
    date = [c.data_inregistrare for c in companies if c.data_inregistrare]
    perioada = ""
    if date:
        lo, hi = min(date), max(date)
        perioada = f"înmatriculate {lo}" if lo == hi else f"înmatriculate {lo} – {hi}"
    return {"perioada": perioada}


def render_standalone(companies) -> str:
    companies = list(companies)
    meta = _meta(companies)
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (
        "<!doctype html>\n<html lang=\"ro\">\n<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        "<title>Firme Noi România</title>\n"
        f"{FONT_LINK}\n<style>{STYLE}</style>\n</head>\n<body>\n"
        f"{_body(companies, meta)}\n{_script(companies, gen)}\n</body>\n</html>\n"
    )


def render_artifact(companies) -> str:
    """Variantă pentru publicare (fără doctype/html/head/body — le adaugă platforma)."""
    companies = list(companies)
    meta = _meta(companies)
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (
        "<title>Firme Noi România</title>\n"
        f"{FONT_LINK}\n<style>{STYLE}</style>\n"
        f"{_body(companies, meta)}\n{_script(companies, gen)}\n"
    )
