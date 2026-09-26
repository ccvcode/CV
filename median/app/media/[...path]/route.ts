import fs from "fs";
import path from "path";
import { paths } from "@/lib/core/config";

/** Servește imaginile procesate din directorul de date (în producție le poate servi direct Caddy). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const rel = parts.join("/");
  if (!/^[\w/-]+\.webp$/.test(rel) || rel.includes("..")) return new Response("Not found", { status: 404 });
  const file = path.join(paths.media, rel);
  try {
    const data = await fs.promises.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
