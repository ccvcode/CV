import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { paths } from "../../core/config";
import { db } from "../../core/db";
import type { ImageRow } from "../../core/types";

export interface Processed {
  fileBase: string;
  widths: number[];
  width: number;
  height: number;
  thumbhash: string;
  color: string;
  ahash: string;
  entropy: number;
}

/**
 * Validează o imagine descărcată și creează variantele WebP. Respinge fișierele care nu sunt
 * imagini (ex. pagini de eroare HTML), prea mici sau corupte.
 */
export async function processImage(buffer: Buffer, widths: number[], opts: { minWidth?: number; crop?: boolean } = {}): Promise<Processed> {
  const img = sharp(buffer, { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height || !meta.format) throw new Error("nu este o imagine validă");
  if (["svg", "gif"].includes(meta.format)) throw new Error(`format respins: ${meta.format}`);
  if (meta.width < (opts.minWidth ?? 200)) throw new Error(`imagine prea mică (${meta.width}px)`);

  const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 20);
  const d = new Date();
  const rel = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${hash}`;
  const dir = path.join(paths.media, path.dirname(rel));
  fs.mkdirSync(dir, { recursive: true });

  const made: number[] = [];
  for (const w of widths) {
    if (w > meta.width * 1.15 && made.length) continue; // nu mărim imaginile mici
    const out = path.join(paths.media, `${rel}-${w}.webp`);
    if (!fs.existsSync(out)) {
      let pipeline = sharp(buffer).rotate().resize({ width: w, withoutEnlargement: true });
      if (opts.crop) pipeline = sharp(buffer).rotate().resize({ width: w, height: Math.round((w * 9) / 16), fit: "cover", position: "attention" });
      await pipeline.webp({ quality: w <= 400 ? 72 : 78, effort: 4 }).toFile(out);
    }
    made.push(w);
  }

  // Placeholder (thumbhash), culoare dominantă, amprentă perceptuală (aHash 8x8) și entropie.
  const small = await sharp(buffer).rotate().resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const th = Buffer.from(rgbaToThumbHash(small.info.width, small.info.height, small.data)).toString("base64");
  const stats = await sharp(buffer).stats();
  const { r, g, b } = stats.dominant;
  const color = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  const grey = await sharp(buffer).rotate().resize(8, 8, { fit: "fill" }).greyscale().raw().toBuffer();
  const avg = grey.reduce((s, v) => s + v, 0) / grey.length;
  const ahash = BigInt("0b" + [...grey].map((v) => (v >= avg ? "1" : "0")).join("")).toString(16).padStart(16, "0");
  const w0 = meta.orientation && meta.orientation >= 5 ? meta.height : meta.width;
  const h0 = meta.orientation && meta.orientation >= 5 ? meta.width : meta.height;
  return { fileBase: rel, widths: made, width: w0, height: h0, thumbhash: th, color, ahash, entropy: stats.entropy };
}

export function saveImageRow(row: {
  kind: ImageRow["kind"];
  originalUrl: string;
  processed?: Processed;
  width?: number;
  height?: number;
  color?: string;
  credit: string;
  creditUrl?: string;
  license?: string;
  licenseUrl?: string;
  sourceId?: string;
}): number {
  const d = db();
  const existing = d.prepare("SELECT id FROM images WHERE original_url = ? AND kind = ?").get(row.originalUrl, row.kind) as { id: number } | undefined;
  const p = row.processed;
  const values = {
    kind: row.kind,
    url: row.originalUrl,
    base: p?.fileBase ?? null,
    widths: JSON.stringify(p?.widths ?? []),
    width: p?.width ?? row.width ?? null,
    height: p?.height ?? row.height ?? null,
    th: p?.thumbhash ?? null,
    color: p?.color ?? row.color ?? null,
    ahash: p?.ahash ?? null,
    credit: row.credit,
    creditUrl: row.creditUrl ?? null,
    license: row.license ?? null,
    licenseUrl: row.licenseUrl ?? null,
    source: row.sourceId ?? null,
    now: Date.now(),
  };
  if (existing) {
    d.prepare(
      `UPDATE images SET file_base = @base, widths = @widths, width = @width, height = @height, thumbhash = @th, color = @color, ahash = @ahash,
         credit = @credit, credit_url = @creditUrl, license = @license, license_url = @licenseUrl, status = 'ok' WHERE id = @id`
    ).run({ ...values, id: existing.id });
    return existing.id;
  }
  const info = d
    .prepare(
      `INSERT INTO images(kind, original_url, file_base, widths, width, height, thumbhash, color, ahash, credit, credit_url, license, license_url, source_id, created_at)
       VALUES (@kind, @url, @base, @widths, @width, @height, @th, @color, @ahash, @credit, @creditUrl, @license, @licenseUrl, @source, @now)`
    )
    .run(values);
  return Number(info.lastInsertRowid);
}
