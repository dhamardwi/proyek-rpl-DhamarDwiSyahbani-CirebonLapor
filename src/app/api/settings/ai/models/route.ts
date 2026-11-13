import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AI_PROVIDERS,
  getAiConfig,
  normalizeBaseUrl,
} from "@/lib/ai/config";
import { listProviderModels } from "@/lib/ai/providers";

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
  provider: z.enum(["NVIDIA"]),
  apiKey: z.string().max(1000).optional().nullable(),
  baseUrl: z.string().max(1000).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return noStore(
      { success: false, message: "Permintaan daftar model tidak valid." },
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

  if (!apiKey) {
    return noStore(
      {
        success: false,
        message:
          "API key belum tersedia. Isi API key lalu simpan sebelum memuat daftar model.",
      },
      400
    );
  }

  try {
    const models = await listProviderModels(provider, { apiKey, baseUrl });
    return noStore({
      success: true,
      message: `${models.length} kandidat model ${definition.label} ditemukan. Uji koneksi untuk memastikan model dapat dipakai API key ini.`,
      data: { provider, models },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat daftar model.";
    console.warn("[AI_MODELS_ERROR]", message);
    return noStore({ success: false, message }, 400);
  }
}
