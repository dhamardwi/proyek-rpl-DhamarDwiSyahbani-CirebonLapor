import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isChatbotAvailable,
  sendChatToNvidia,
  type ChatMessage,
} from "@/lib/chatbot-service";
import {
  getChatbotDbData,
  formatDbContext,
  answerDataQuestion,
  answerRoleScopeQuestion,
  answerChatbotIdentity,
  answerUserStatusCount,
  resolveUserRef,
  type ChatbotRole,
} from "@/lib/chatbot-context";

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Fallback lokal untuk sapaan/pertanyaan umum di luar topik laporan.
 * Pertanyaan yang berkaitan dengan laporan sudah dijawab dari DB oleh
 * answerDataQuestion(); di sini kita tidak boleh mengarang jawaban.
 */
function localFallback(message: string): string {
  const lower = message.toLowerCase().trim();

  if (/^(halo|hai|hi|hello|selamat (pagi|siang|sore|malam)|assalamualaikum)/.test(lower)) {
    return "Halo, ada yang bisa saya bantu?";
  }

  if (/terima kasih|makasih|thanks|thank you/.test(lower)) {
    return "Sama-sama.";
  }

  if (/siapa kamu|kamu siapa|nama kamu|apa kamu|kamu bot/.test(lower)) {
    return "Saya Asisten Lapor Desa, chatbot untuk melaporkan dan memantau kerusakan fasilitas umum desa.";
  }

  return "Maaf, saya tidak tahu jawabannya.";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const rawMessages = body?.messages as ClientMessage[] | undefined;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pesan tidak boleh kosong." },
        { status: 422 }
      );
    }

    // Ambil maksimal N pesan terakhir, validasi & sanitasi
    const sanitized: ChatMessage[] = rawMessages
      .slice(-MAX_HISTORY)
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({
        role: m.role,
        content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((m) => m.content.length > 0);

    if (sanitized.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pesan tidak valid." },
        { status: 422 }
      );
    }

    const lastUserMessage =
      [...sanitized].reverse().find((m) => m.role === "user")?.content ?? "";

    // Konteks DB aktual (read-only, fail-open): jika gagal, tetap lanjut tanpa konteks
    // agar kemampuan stabil chatbot tidak berubah.
    const role: ChatbotRole =
      session.user.role === "ADMIN" || session.user.role === "PETUGAS"
        ? session.user.role
        : "MASYARAKAT";
    const dbData = await getChatbotDbData(session.user.id, role, lastUserMessage);
    const dbContext = dbData ? formatDbContext(dbData, role) : "";

    // Jawaban berbasis data aktual. Jika tersedia, dipakai langsung agar
    // jawaban spesifik dan tidak melebar ke topik lain.
    const identityReply = answerChatbotIdentity(lastUserMessage, role);
    const userRef = role === "ADMIN" ? await resolveUserRef(lastUserMessage) : null;
    const userReply = userRef
      ? await answerUserStatusCount(lastUserMessage, role, userRef.userId, userRef.asPetugas)
      : null;
    const dataReply =
      identityReply ??
      userReply ??
      (dbData
        ? answerDataQuestion(lastUserMessage, dbData, role)
        : answerRoleScopeQuestion(lastUserMessage, role));

    if (dataReply) {
      return NextResponse.json({
        success: true,
        reply: dataReply,
        fallback: false,
      });
    }

    // Jika API key belum diset, pakai jawaban lokal agar chatbot tetap berguna
    if (!isChatbotAvailable()) {
      return NextResponse.json({
        success: true,
        reply: localFallback(lastUserMessage),
        fallback: true,
      });
    }

    try {
      const reply = await sendChatToNvidia(sanitized, dbContext, role);
      return NextResponse.json({
        success: true,
        reply,
        fallback: false,
      });
    } catch (aiError) {
      console.error("[CHATBOT_ERROR]", aiError);
      // Fallback lokal agar UX tidak rusak saat kuota/error upstream
      return NextResponse.json({
        success: true,
        reply: localFallback(lastUserMessage),
        fallback: true,
      });
    }
  } catch (error) {
    console.error("[CHATBOT_ROUTE_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
