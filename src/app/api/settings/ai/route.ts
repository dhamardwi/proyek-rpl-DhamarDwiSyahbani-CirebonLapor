import { z } from "zod";
import { getCurrentSession } from "@/lib/auth-session";
import { noStore } from "@/lib/api-response";
import {
  getAiProviderStatuses,
  saveAiConfig,
} from "@/lib/ai/config";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session?.user) {
    return { error: noStore({ success: false, message: "Unauthorized" }, 401) };
  }
  if (session.user.role !== "ADMIN") {
    return { error: noStore({ success: false, message: "Akses ditolak." }, 403) };
  }
  return { session };
}

const saveSchema = z.object({
  provider: z.enum(["NVIDIA"]),
  apiKey: z.string().max(1000).optional().nullable(),
  clearApiKey: z.boolean().optional(),
  baseUrl: z.string().max(1000).optional().nullable(),
  model: z.string().max(300).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const providers = await getAiProviderStatuses();
    return noStore({
      success: true,
      data: {
        providers,
        chatbotAvailable:
          providers.find((item) => item.provider === "NVIDIA")?.available ?? false,
      },
    });
  } catch (error) {
    console.error(
      "[AI_SETTINGS_GET_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore(
      { success: false, message: "Gagal mengambil konfigurasi AI." },
      500
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);

  if (!parsed.success) {
    return noStore(
      {
        success: false,
        message: "Data konfigurasi tidak valid.",
        errors: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const { provider, baseUrl, model } = parsed.data;

  if (baseUrl && !/^https?:\/\//i.test(baseUrl.trim())) {
    return noStore(
      { success: false, message: "Base URL harus diawali http:// atau https://." },
      422
    );
  }

  if (model !== undefined && model !== null && model.trim().length === 0) {
    return noStore(
      { success: false, message: "Model tidak boleh kosong." },
      422
    );
  }

  try {
    const status = await saveAiConfig({
      provider,
      apiKey: parsed.data.apiKey ?? null,
      clearApiKey: parsed.data.clearApiKey,
      baseUrl: parsed.data.baseUrl ?? null,
      model: parsed.data.model ?? null,
      isActive: parsed.data.isActive,
      updatedById: auth.session?.user.id ?? null,
    });

    return noStore({
      success: true,
      message: `Konfigurasi ${status.label} berhasil disimpan.`,
      data: status,
    });
  } catch (error) {
    console.error(
      "[AI_SETTINGS_PUT_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore(
      { success: false, message: "Gagal menyimpan konfigurasi AI." },
      500
    );
  }
}
