import { NextResponse } from "next/server";
import { recordView } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: unknown };
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
    if (typeof id === "string" && /^[a-z0-9]{4,20}$/.test(id)) recordView(id, ip);
  } catch {}
  return new NextResponse(null, { status: 204 });
}
