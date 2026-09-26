// Copie statică a site-ului Median (serverul rulează pe BASE, implicit http://localhost:3000), pentru publicare ca artifact.
// Rulare: INLINE=1 LIMIT=440 STAMP="text banner" node scripts/export/static.mjs [director-ieșire, implicit ./out]
// INLINE=1 pune pozele în pagini (un artifact are limită de ~500 de fișiere).
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(path.join(ROOT, "package.json"));
const { parseHTML } = require("linkedom");

const BASE = process.env.BASE ?? "http://localhost:3000";
const MEDIA = path.join(process.env.MEDIAN_DATA_DIR ?? path.join(ROOT, "data"), "media");
const OUT = process.argv[2] ?? path.join(ROOT, "out");
const STAMP = process.env.STAMP ?? "";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const CATS = ["national", "politica", "international", "economie", "sport", "tech", "sanatate", "auto", "cultura", "lifestyle", "monden"];
const REGIONS = ["europa", "ucraina", "sua", "orientul-mijlociu", "moldova", "asia", "lume"];
const LISTING = ["/", "/pe-scurt", ...CATS.map((c) => `/categorie/${c}`), ...REGIONS.map((r) => `/categorie/international?regiune=${r}`)];
const STATIC = ["/azi", "/unghi-mort", "/alerte", "/surse", "/despre", "/politica-editoriala", "/politica-ai", "/corecturi", "/contact", "/termeni", "/confidentialitate", "/cookies"];

function fileFor(href) {
  const u = new URL(href, BASE);
  if (u.origin !== BASE) return null;
  const p = u.pathname.replace(/\/$/, "");
  if (p === "") return "index.html";
  const reg = u.searchParams.get("regiune");
  if (p.startsWith("/categorie/")) return `categorie-${p.split("/")[2]}${reg ? `-regiune-${reg}` : ""}.html`;
  if (p.startsWith("/stire/")) return `stire-${p.split("/")[2].split("-").pop()}.html`; // doar ID-ul: nume scurte
  if ([...STATIC, "/pe-scurt"].includes(p)) return p.slice(1) + ".html";
  return null;
}

const pages = new Map(); // fișier -> html brut
async function get(href) {
  const r = await fetch(BASE + href);
  if (!r.ok) throw new Error(`${href}: HTTP ${r.status}`);
  return r.text();
}

// 1. Paginile de listă și cele statice; știrile legate de ele (fără a urma legăturile din știri).
const stories = new Set();
for (const href of ["/", ...STATIC, ...LISTING.slice(1)]) {
  const html = await get(href);
  pages.set(fileFor(href), html);
  if (LISTING.includes(href) || ["/azi", "/unghi-mort"].includes(href)) for (const m of html.matchAll(/href="(\/stire\/[^"#?]+)"/g)) stories.add(m[1]);
}
const LIMIT = Number(process.env.LIMIT ?? 400);
for (const href of [...stories].slice(0, LIMIT)) pages.set(fileFor(href), await get(href));
console.log(`pagini: ${pages.size} (știri: ${Math.min(stories.size, LIMIT)} din ${stories.size})`);

// 2. CSS + fonturi.
const cssHrefs = new Set();
for (const html of pages.values()) for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)) cssHrefs.add(m[1]);
let css = "";
for (const h of cssHrefs) css += await get(h);
fs.mkdirSync(path.join(OUT, "fonts"));
for (const m of new Set([...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]))) {
  const src = m.replace(/^["']|["']$/g, "");
  const name = src.split("/").pop();
  const buf = Buffer.from(await (await fetch(new URL(src, BASE + "/_next/static/chunks/"))).arrayBuffer());
  fs.writeFileSync(path.join(OUT, "fonts", name), buf);
  css = css.split(m).join(`fonts/${name}`);
}
// Fonturile latin-ext/latin sunt suficiente pentru română; restul (chirilic, vietnamez) nu se folosesc.
fs.writeFileSync(path.join(OUT, "site.css"), css);
fs.copyFileSync(path.join(ROOT, "public/visit.js"), path.join(OUT, "visit.js"));

// 3. Pagini: doar conținutul <body>, fără scripturile Next, cu legături și imagini locale.
const usedMedia = new Set();
function pickSrc(img) {
  const set = (img.getAttribute("srcset") || img.getAttribute("srcSet") || "").split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
  const all = set.length ? set : [img.getAttribute("src")];
  const w = (u) => Number(/-(\d+)\.webp$/.exec(u)?.[1] ?? 0);
  // data-slot = câți pixeli din sursă sunt necesari pe lățimea locului (calculat de componenta Figure).
  const slot = Number(img.getAttribute("data-slot") || 0) || 800;
  const want = Math.min(slot * 1.5, 1600); // ~1,5x pentru ecranele dense, fără a exagera mărimea copiei
  const sorted = all.sort((a, b) => w(a) - w(b));
  return sorted.find((u) => w(u) >= want) ?? sorted[sorted.length - 1];
}

const THEME = `<script>(function(){try{var t=localStorage.getItem('median-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}document.documentElement.lang='ro';try{history.scrollRestoration='manual'}catch(e){}if(!location.hash){var top=function(){window.scrollTo(0,0);try{var f=document.body&&document.body.firstElementChild;if(f)f.scrollIntoView({block:'start'})}catch(e){}};top();addEventListener('DOMContentLoaded',function(){if(window.scrollY<5||!window.__medianScrolled)top()});addEventListener('scroll',function(){window.__medianScrolled=1},{once:true,passive:true})}document.addEventListener('click',function(e){var b=e.target.closest('button[aria-label="Schimbă tema"]');if(!b)return;var r=document.documentElement,d=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'light':'dark';try{localStorage.setItem('median-theme',r.dataset.theme)}catch(e){}})})();</script>`;

for (const [file, html] of pages) {
  const { document } = parseHTML(html);
  const title = document.querySelector("title")?.textContent ?? "Median";
  const desc = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  const body = document.body;
  body.querySelectorAll("script, noscript, template, next-route-announcer, link, style").forEach((n) => n.remove());
  // Butoanele care cer JavaScript-ul aplicației (căutare, salvare, partajare) nu au efect într-o copie statică.
  body.querySelectorAll("button").forEach((b) => {
    const t = (b.textContent || "").trim();
    if (b.getAttribute("aria-label") === "Schimbă tema") return;
    const label = b.getAttribute("aria-label") || "";
    if (/^(Căutare|Meniu|Salvează|Distribuie|Copiază|Semnalează)/i.test(t) || /^(Urmărește|Nu mai urmări)/.test(label) || b.closest("form")) b.remove();
  });
  body.querySelectorAll("form, [data-tools]").forEach((f) => f.remove());
  for (const a of body.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (/^https?:/.test(href) && !href.startsWith(BASE)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      continue;
    }
    if (href.startsWith("#")) continue;
    const f = fileFor(href);
    if (f && pages.has(f)) a.setAttribute("href", f);
    else {
      const span = document.createElement("span");
      span.innerHTML = a.innerHTML;
      span.setAttribute("class", a.getAttribute("class") || "");
      a.replaceWith(span);
    }
  }
  for (const img of body.querySelectorAll("img")) {
    const src = pickSrc(img);
    if (src?.startsWith("/media/")) {
      usedMedia.add(src);
      // INLINE=1: imaginea intră în pagină (limita de fișiere a unui artifact e ~500).
      if (process.env.INLINE === "1") img.setAttribute("src", "data:image/webp;base64," + fs.readFileSync(path.join(MEDIA, src.replace(/^\/media\//, ""))).toString("base64"));
      else img.setAttribute("src", src.slice(1));
    }
    img.removeAttribute("srcset");
    img.removeAttribute("srcSet");
    img.removeAttribute("sizes");
    img.setAttribute("loading", "lazy");
  }
  const banner = STAMP
    ? `<div style="background:var(--band,#111110);color:var(--on-band,#f4f1ea);font:600 12px/1.4 system-ui,sans-serif;padding:8px 16px;text-align:center">${STAMP}</div>`
    : "";
  const head = `<title>${title.replace(/</g, "&lt;")}</title>\n<meta name="description" content="${desc.replace(/"/g, "&quot;")}">\n<link rel="stylesheet" href="site.css">\n${THEME}`;
  // Doar pagina principală e învelită automat la publicare; celelalte au nevoie de document complet.
  const out =
    file === "index.html"
      ? `${head}\n${banner}${body.innerHTML}\n<script src="visit.js"></script>`
      : `<!doctype html>\n<html lang="ro">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n${banner}${body.innerHTML}\n<script src="visit.js"></script>\n</body>\n</html>\n`;
  fs.writeFileSync(path.join(OUT, file), out);
}

// 4. Imaginile folosite (o singură variantă per loc).
for (const src of process.env.INLINE === "1" ? [] : usedMedia) {
  const rel = src.replace(/^\/media\//, "");
  fs.mkdirSync(path.join(OUT, "media", path.dirname(rel)), { recursive: true });
  fs.copyFileSync(path.join(MEDIA, rel), path.join(OUT, "media", rel));
}
const files = fs.readdirSync(OUT, { recursive: true }).filter((f) => fs.statSync(path.join(OUT, f)).isFile());
const size = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`fișiere: ${files.length}, imagini: ${usedMedia.size}, total ${(size / 1e6).toFixed(1)} MB`);
