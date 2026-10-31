import { NextResponse } from "next/server";
import { pollTelegramUpdatesOnce } from "@/lib/telegram/polling";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pollTelegramUpdatesOnce();

    if (result.skipped) {
      return NextResponse.json(
        { ok: false, error: "polling not enabled" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, updates: result.processed });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 502 });
  }
}
