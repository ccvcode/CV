/*
 * Imagini generate pentru rețeaua demo: „fotografii” editoriale estompate (gradiente, forme
 * moi, granulație, vignetare) pe scene diferite, plus imaginea implicită a fiecărei publicații
 * (logo pe fundal plat) — folosită pentru a testa detectarea imaginilor generice.
 * Fișierele se păstrează în scripts/demo-network/.cache/ (ignorat de git).
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { ImageSpec, Outlet, Scene } from "./content";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(HERE, ".cache", "img");
const VERSION = "v4";

export const FULL = { width: 1600, height: 900 };
export const TINY = { width: 300, height: 169 };
export const DEFAULT_OG = { width: 1200, height: 630 };

/* ------------------------------------------------------------------ utilitare */

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG determinist (mulberry32), ca aceeași cheie să producă mereu aceeași imagine. */
function rng(seed: string): () => number {
  let a = hash32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h: number, s: number, l: number, a = 1) =>
  a >= 1 ? `hsl(${Math.round(((h % 360) + 360) % 360)},${Math.round(s)}%,${Math.round(l)}%)` : `hsla(${Math.round(((h % 360) + 360) % 360)},${Math.round(s)}%,${Math.round(l)}%,${a})`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ scene */

const W = FULL.width;
const H = FULL.height;

interface Palette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundDark: string;
  glow: string;
  night: boolean;
}

function palette(scene: Scene, hue: number, r: () => number): Palette {
  const night = scene === "night" || scene === "stage" || (scene === "city" && r() < 0.25);
  if (night) {
    return {
      skyTop: hsl(hue + 220, 45, 8),
      skyBottom: hsl(hue + 200, 40, 22),
      ground: hsl(hue + 220, 30, 10),
      groundDark: hsl(hue + 220, 30, 5),
      glow: hsl(hue + 30, 90, 60),
      night,
    };
  }
  const warm = r() < 0.35; // lumină de dimineață / apus
  return {
    skyTop: warm ? hsl(hue + 200, 45, 55) : hsl(205 + (hue % 20), 55, 62),
    skyBottom: warm ? hsl(28 + (hue % 15), 80, 78) : hsl(200, 40, 86),
    ground: hsl(hue, 35, 38),
    groundDark: hsl(hue, 30, 22),
    glow: warm ? hsl(35, 100, 75) : hsl(55, 100, 92),
    night,
  };
}

function skyAndGlow(p: Palette, r: () => number): string {
  const gx = 200 + r() * 1200;
  const gy = 120 + r() * 250;
  let s = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.skyTop}"/><stop offset="1" stop-color="${p.skyBottom}"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${p.glow}" stop-opacity="${p.night ? 0.5 : 0.85}"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
    <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.ground}"/><stop offset="1" stop-color="${p.groundDark}"/></linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="${7 + r() * 6}"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="40"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <ellipse cx="${gx}" cy="${gy}" rx="${380 + r() * 200}" ry="${300 + r() * 150}" fill="url(#glow)"/>`;
  // nori / pete de lumină
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    s += `<ellipse filter="url(#soft)" cx="${r() * W}" cy="${60 + r() * 300}" rx="${150 + r() * 250}" ry="${40 + r() * 60}" fill="${p.night ? "#223" : "#fff"}" fill-opacity="${0.25 + r() * 0.35}"/>`;
  }
  return s;
}

function hills(y: number, amp: number, color: string, r: () => number, segments = 6): string {
  let d = `M0 ${H} L0 ${y}`;
  const step = W / segments;
  for (let i = 0; i < segments; i++) {
    const x1 = i * step + step / 2;
    const y1 = y - amp * (0.3 + r());
    const x2 = (i + 1) * step;
    const y2 = y + (r() - 0.5) * amp * 0.6;
    d += ` Q${x1.toFixed(0)} ${y1.toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)}`;
  }
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
}

function mountains(y: number, color: string, r: () => number, peaks = 5): string {
  let d = `M0 ${H} L0 ${y + 60}`;
  const step = W / peaks;
  for (let i = 0; i < peaks; i++) {
    d += ` L${(i * step + step * (0.3 + r() * 0.4)).toFixed(0)} ${(y - 120 - r() * 220).toFixed(0)}`;
    d += ` L${((i + 1) * step).toFixed(0)} ${(y + r() * 80).toFixed(0)}`;
  }
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
}

function skyline(base: number, p: Palette, r: () => number): string {
  let s = "";
  let x = -20;
  while (x < W) {
    const w = 50 + r() * 130;
    const h = 120 + r() * 380;
    const shade = p.night ? hsl(230, 25, 10 + r() * 8) : hsl(215, 15, 30 + r() * 25);
    s += `<rect x="${x.toFixed(0)}" y="${(base - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 10).toFixed(0)}" fill="${shade}"/>`;
    // ferestre
    const cols = Math.max(2, Math.floor(w / 22));
    const rows = Math.floor(h / 34);
    for (let c = 0; c < cols; c++)
      for (let rr = 0; rr < rows; rr++) {
        if (r() < (p.night ? 0.75 : 0.8)) continue;
        s += `<rect x="${(x + 6 + c * 22).toFixed(0)}" y="${(base - h + 14 + rr * 34).toFixed(0)}" width="10" height="16" fill="${p.night ? "#ffd98a" : "#dfe8f0"}" fill-opacity="${p.night ? 0.9 : 0.5}"/>`;
      }
    x += w + r() * 8;
  }
  return s;
}

function bokeh(n: number, colorHue: number, r: () => number, yMin = 0, yMax = H): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const rad = 12 + r() * 60;
    s += `<circle cx="${(r() * W).toFixed(0)}" cy="${(yMin + r() * (yMax - yMin)).toFixed(0)}" r="${rad.toFixed(0)}" fill="${hsl(colorHue + r() * 50, 90, 60 + r() * 20)}" fill-opacity="${(0.15 + r() * 0.45).toFixed(2)}"/>`;
  }
  return s;
}

function sceneBody(scene: Scene, hue: number, p: Palette, r: () => number): string {
  switch (scene) {
    case "mountain": {
      const g = 85 + (hue % 50);
      return mountains(520, hsl(215, 14, 58), r, 4) + mountains(620, hsl(g + 40, 22, 32), r, 6) + hills(760, 60, hsl(g, 35, 22), r);
    }
    case "landscape": {
      const g = 60 + (hue % 60);
      return hills(560, 80, hsl(g + 20, 22, 52), r, 4) + hills(660, 90, hsl(g, 38, 36), r, 5) + hills(780, 60, hsl(g - 10, 42, 24), r, 7);
    }
    case "sea": {
      const horizon = 500 + r() * 80;
      return `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${hsl(205, 50, 38)}"/>
        <rect y="${horizon}" width="${W}" height="30" fill="#fff" fill-opacity="0.25"/>
        ${Array.from({ length: 22 }, () => `<rect x="${(r() * W).toFixed(0)}" y="${(horizon + 20 + r() * (H - horizon)).toFixed(0)}" width="${(80 + r() * 300).toFixed(0)}" height="4" fill="#fff" fill-opacity="${(0.1 + r() * 0.3).toFixed(2)}"/>`).join("")}
        ${r() < 0.6 ? `<rect x="${(200 + r() * 900).toFixed(0)}" y="${horizon - 90}" width="${(160 + r() * 200).toFixed(0)}" height="70" fill="${hsl(hue, 30, 25)}"/><rect x="${(300 + r() * 700).toFixed(0)}" y="${horizon - 160}" width="14" height="140" fill="${hsl(hue, 20, 20)}"/>` : ""}`;
    }
    case "city":
    case "night":
      return skyline(760, p, r) + skyline(840, { ...p, night: p.night }, r) + `<rect y="830" width="${W}" height="${H - 830}" fill="${p.night ? "#0b0d14" : hsl(220, 10, 25)}"/>` + (p.night ? bokeh(30, 20, r, 700, 900) : "");
    case "road": {
      const vx = 600 + r() * 400;
      const vy = 470;
      return hills(vy + 20, 50, hsl(70 + (hue % 50), 28, 40), r, 5) + `<path d="M${vx - 20} ${vy} L${vx + 20} ${vy} L${W + 200} ${H} L-200 ${H} Z" fill="${hsl(220, 8, 30)}"/>
        <path d="M${vx - 2} ${vy} L${vx + 2} ${vy} L${W / 2 + 18} ${H} L${W / 2 - 18} ${H} Z" fill="#f2f2f2" fill-opacity="0.7"/>
        ${bokeh(10, hue > 180 ? 0 : 30, r, vy - 20, vy + 120)}`;
    }
    case "stadium":
      return `<ellipse cx="${W / 2}" cy="${H + 120}" rx="${W * 0.75}" ry="520" fill="${hsl(125, 45, 32)}"/>
        <ellipse cx="${W / 2}" cy="${H + 120}" rx="${W * 0.75}" ry="520" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="6"/>
        <rect y="300" width="${W}" height="140" fill="${hsl(hue, 30, 20)}"/>
        ${bokeh(120, hue, r, 300, 440)}
        ${bokeh(6, 50, r, 40, 160)}`;
    case "interior":
      return `<rect width="${W}" height="${H}" fill="${hsl(hue + 20, 25, 30)}"/>
        ${Array.from({ length: 3 }, (_, i) => `<rect x="${120 + i * 480 + r() * 40}" y="${100 + r() * 40}" width="${300 + r() * 60}" height="${420 + r() * 60}" fill="${hsl(45, 60, 85)}" fill-opacity="${0.55 + r() * 0.3}"/>`).join("")}
        <rect y="650" width="${W}" height="250" fill="${hsl(hue + 20, 25, 18)}"/>
        ${bokeh(14, 35, r, 580, 820)}`;
    case "tech":
      return `<rect width="${W}" height="${H}" fill="${hsl(hue, 50, 12)}"/>
        ${Array.from({ length: 16 }, () => `<rect x="${(r() * W).toFixed(0)}" y="${(r() * H).toFixed(0)}" width="${(200 + r() * 500).toFixed(0)}" height="3" fill="${hsl(hue - 40, 90, 65)}" fill-opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`).join("")}
        ${bokeh(45, hue - 60, r)}`;
    case "crowd":
      return hills(600, 30, hsl(hue, 20, 45), r, 3) + Array.from({ length: 160 }, () => {
        const x = r() * W;
        const y = 560 + r() * 360;
        const s = 14 + (y - 560) / 10;
        const c = hsl(hue + r() * 120, 30 + r() * 40, 20 + r() * 40);
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${s.toFixed(0)}" fill="${c}"/><rect x="${(x - s * 1.4).toFixed(0)}" y="${(y + s * 0.8).toFixed(0)}" width="${(s * 2.8).toFixed(0)}" height="${(s * 4).toFixed(0)}" rx="${s.toFixed(0)}" fill="${c}"/>`;
      }).join("");
    case "stage":
      return `<rect width="${W}" height="${H}" fill="${hsl(hue, 40, 8)}"/>
        ${Array.from({ length: 5 }, (_, i) => {
          const x = 200 + i * 300 + r() * 60;
          return `<path d="M${x} 0 L${x - 220} 720 L${x + 220} 720 Z" fill="${hsl(hue + i * 25, 80, 70)}" fill-opacity="0.18"/>`;
        }).join("")}
        <rect y="700" width="${W}" height="200" fill="${hsl(hue, 30, 14)}"/>
        ${bokeh(40, hue, r, 740, 900)}`;
    case "sky":
    default:
      return hills(780, 40, hsl(80 + (hue % 60), 25, 28), r, 8);
  }
}

function photoSvg(key: string, spec: ImageSpec): string {
  const r = rng(key);
  const hue = spec.hue ?? hash32(key) % 360;
  const p = palette(spec.scene, hue, r);
  const sky = spec.scene === "interior" || spec.scene === "tech" || spec.scene === "stage" ? `<defs><radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="${8 + r() * 6}"/></filter><filter id="soft"><feGaussianBlur stdDeviation="40"/></filter></defs>` : skyAndGlow(p, r);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${sky}
  <g filter="url(#blur)">${sceneBody(spec.scene, hue, p, r)}</g>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}

let grain: Promise<Buffer> | undefined;
function grainLayer(): Promise<Buffer> {
  grain ??= sharp({ create: { width: W, height: H, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 22 } } })
    .greyscale()
    .raw()
    .toBuffer();
  return grain;
}

function watermarkSvg(outlet: Outlet, w: number, h: number): string {
  const fs = Math.round(h * 0.03);
  const text = esc(outlet.name.toUpperCase());
  const tw = Math.round(text.length * fs * 0.68 + fs * 1.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect x="${w - tw - fs}" y="${h - fs * 2.6}" width="${tw}" height="${fs * 1.8}" rx="${fs * 0.3}" fill="#000" fill-opacity="0.35"/>
    <text x="${w - fs * 1.8}" y="${h - fs * 1.3}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="${fs}" fill="#fff" fill-opacity="0.85" letter-spacing="1">${text}</text>
  </svg>`;
}

/* ------------------------------------------------------------------ API */

export type ImageVariant = "full" | "tiny";

/** Imaginea unui articol (1600×900 sau 300×169). Returnează calea fișierului JPEG din cache. */
export async function ensureArticleImage(key: string, spec: ImageSpec, outlet: Outlet, variant: ImageVariant = "full"): Promise<string> {
  const file = path.join(CACHE_DIR, outlet.id, `${key}${variant === "tiny" ? "-300x169" : ""}-${VERSION}.jpg`);
  if (await exists(file)) return file;
  await mkdir(path.dirname(file), { recursive: true });
  // Scena e oricum estompată: o randăm la jumătate de rezoluție și o mărim (de ~4 ori mai rapid).
  const base = await sharp(Buffer.from(photoSvg(key, spec)), { density: 36 })
    .resize(W, H)
    .composite([
      { input: await grainLayer(), raw: { width: W, height: H, channels: 1 }, blend: "soft-light" },
      { input: Buffer.from(watermarkSvg(outlet, W, H)) },
    ])
    .modulate({ saturation: 0.9 })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();
  const out = variant === "tiny" ? await sharp(base).resize(TINY.width, TINY.height).jpeg({ quality: 78 }).toBuffer() : base;
  await writeFile(file, out);
  return file;
}

/** Imaginea implicită a publicației (logo pe fundal plat, 1200×630) — og:image generic. */
export async function ensureDefaultImage(outlet: Outlet): Promise<string> {
  const file = path.join(CACHE_DIR, outlet.id, `default-og-${VERSION}.jpg`);
  if (await exists(file)) return file;
  await mkdir(path.dirname(file), { recursive: true });
  const { width: w, height: h } = DEFAULT_OG;
  const name = esc(outlet.name);
  const fs = name.length > 16 ? 86 : 104;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${outlet.color}"/>
    <rect x="${w / 2 - 60}" y="${h / 2 - 110}" width="120" height="12" fill="${outlet.accent}"/>
    <text x="${w / 2}" y="${h / 2 + 30}" text-anchor="middle" font-family="DejaVu Serif, Georgia, serif" font-weight="bold" font-size="${fs}" fill="#fff">${name}</text>
    <text x="${w / 2}" y="${h / 2 + 100}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#fff" fill-opacity="0.75">${esc(outlet.tagline)}</text>
    <text x="${w / 2}" y="${h - 40}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#fff" fill-opacity="0.5">${esc(outlet.domain)}</text>
  </svg>`;
  await writeFile(file, await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer());
  return file;
}

export async function readImage(file: string): Promise<Buffer> {
  return readFile(file);
}
