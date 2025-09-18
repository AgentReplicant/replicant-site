// app/api/chatlog/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enabled = process.env.CHAT_LOG_ENABLED === "1"; // toggle later
const token = process.env.AIRTABLE_TOKEN || "";
const baseId = process.env.AIRTABLE_BASE_ID || "";
const table = process.env.CONVERSATIONS_TABLE_NAME || "Conversations";

export async function POST(req: NextRequest) {
  if (!enabled) return NextResponse.json({ ok: true, logged: false, reason: "disabled" });
  if (!token || !baseId) {
    return NextResponse.json({ ok: false, error: "Airtable not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({} as any));
  const record = {
    SessionId: body.sessionId || "",
    Role: body.role || "user",
    Message: body.message || "",
    PageURL: body.pageUrl || "",
    Source: body.source || "Replicant site",
    At: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: [{ fields: record }], typecast: true }),
      }
    ).then((r) => r.json());

    return NextResponse.json({ ok: true, id: res.records?.[0]?.id || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "log failed" }, { status: 500 });
  }
}
