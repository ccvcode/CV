import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { CATEGORY_MAP } from "../../core/categories";
import type { CategorySlug } from "../../core/types";
import { processImage, saveImageRow } from "./store";

/*
 * Copertă tipografică generată automat — ultima variantă, care nu eșuează niciodată, când nu
 * există o fotografie cu licență potrivită. Stil „hârtie și cerneală”, identic cu site-ul.
 */

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" };
let fonts: Font[] | null = null;

function loadFonts(): Font[] {
  if (fonts) return fonts;
  const f = (pkg: string, file: string) => {
    const b = fs.readFileSync(path.join(process.cwd(), "node_modules", pkg, "files", file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };
  fonts = [
    { name: "Newsreader", data: f("@fontsource/newsreader", "newsreader-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "NewsreaderExt", data: f("@fontsource/newsreader", "newsreader-latin-ext-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Archivo", data: f("@fontsource/archivo", "archivo-latin-800-normal.woff"), weight: 800, style: "normal" },
    { name: "ArchivoExt", data: f("@fontsource/archivo", "archivo-latin-ext-800-normal.woff"), weight: 800, style: "normal" },
    { name: "Archivo", data: f("@fontsource/archivo", "archivo-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "ArchivoExt", data: f("@fontsource/archivo", "archivo-latin-ext-700-normal.woff"), weight: 700, style: "normal" },
  ];
  return fonts;
}

// Element JSX-like pentru satori, fără React.
type El = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): El => ({ type, props: { style, children } });

export async function renderCard(opts: { headline: string; category: CategorySlug; sources: number; region?: string | null }): Promise<Buffer> {
  const W = 1600;
  const H = 900;
  const label = (CATEGORY_MAP[opts.category]?.label ?? "Știri").toUpperCase();
  const len = opts.headline.length;
  const size = len < 50 ? 104 : len < 80 ? 88 : len < 110 ? 74 : 62;
  const tree = h(
    "div",
    { width: W, height: H, display: "flex", flexDirection: "column", background: "#F4F1EA", padding: "72px 88px", fontFamily: "Newsreader, NewsreaderExt", color: "#111110" },
    [
      h("div", { display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "4px solid #111110", paddingBottom: 22 }, [
        h("div", { display: "flex", alignItems: "center", fontFamily: "Archivo, ArchivoExt", fontWeight: 800, fontSize: 46, letterSpacing: -1 }, [
          h("div", { display: "flex" }, "MEDIAN"),
          h("div", { width: 22, height: 22, background: "#E23B1E", marginLeft: 8, marginTop: 8 }),
        ]),
        h("div", { display: "flex", fontFamily: "Archivo, ArchivoExt", fontWeight: 700, fontSize: 26, letterSpacing: 3, color: "#55524B" }, label + (opts.region ? ` · ${opts.region.toUpperCase().replace(/-/g, " ")}` : "")),
      ]),
      h("div", { display: "flex", flexGrow: 1, alignItems: "center" }, [
        h("div", { display: "flex", width: 12, alignSelf: "stretch", background: "#E23B1E", marginRight: 44, marginTop: 70, marginBottom: 70 }),
        h("div", { display: "flex", fontSize: size, fontWeight: 600, lineHeight: 1.06, letterSpacing: -1.5, maxWidth: 1330 }, opts.headline),
      ]),
      h("div", { display: "flex", justifyContent: "space-between", borderTop: "2px solid #D6D0C2", paddingTop: 22, fontFamily: "Archivo, ArchivoExt", fontWeight: 700, fontSize: 24, color: "#55524B", letterSpacing: 1 }, [
        h("div", { display: "flex" }, opts.sources > 1 ? `SINTEZĂ DIN ${opts.sources} SURSE` : "ȘTIRE SEMNALATĂ DE MEDIAN"),
        h("div", { display: "flex" }, "median.ro"),
      ]),
    ]
  );
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}

export async function makeCard(storyId: string, opts: Parameters<typeof renderCard>[0]): Promise<number> {
  const png = await renderCard(opts);
  const processed = await processImage(png, [640, 1200, 1600], { minWidth: 200 });
  return saveImageRow({ kind: "card", originalUrl: `card:${storyId}:${processed.fileBase}`, processed, credit: "Grafică: Median" });
}
