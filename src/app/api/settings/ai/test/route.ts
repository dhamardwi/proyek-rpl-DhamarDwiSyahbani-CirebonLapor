import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AI_PROVIDERS,
  getAiConfig,
  normalizeBaseUrl,
  normalizeModel,
} from "@/lib/ai/config";
import { testProviderConnection } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: noStore({ success: false, message: "Unauthorized" }, 401) };
  }
  if (session.user.role !== "ADMIN") {
    return { error: noStore({ success: false, message: "Akses ditolak." }, 403) };
  }
  return { session };
}

const schema = z.object({
  provider: z.enum(["NVIDIA", "GEMINI"]),
  apiKey: z.string().max(1000).optional().nullable(),
  baseUrl: z.string().max(1000).optional().nullable(),
  model: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return noStore(
      { success: false, message: "Permintaan uji koneksi tidak valid." },
      422
    );
  }

  const { provider } = parsed.data;
  const definition = AI_PROVIDERS[provider];
  const stored = await getAiConfig(provider);

  const apiKey = parsed.data.apiKey?.trim() || stored.apiKey || "";
  const baseUrl = normalizeBaseUrl(
    parsed.data.baseUrl || stored.baseUrl,
    definition.baseUrl
  );
  const model = normalizeModel(
    parsed.data.model || stored.model,
    definition.model,
    provider
  );

  const result = await testProviderConnection(provider, { apiKey, baseUrl, model });

  return noStore(
    {
      success: result.ok,
      message: result.message,
      data: { ...result, provider, model, baseUrl },
    },
    result.ok ? 200 : 400
  );
}
