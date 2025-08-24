import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  return NextResponse.json({ ok: true, code, note: "OAuth stub — token exchange later" });
}
