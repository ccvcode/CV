import { NextResponse } from "next/server";
import { recordView } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: unknown };
    if (typeof id === "string" && /^[a-z0-9]{4,20}$/.test(id)) recordView(id);
  } catch {}
  return new NextResponse(null, { status: 204 });
}
