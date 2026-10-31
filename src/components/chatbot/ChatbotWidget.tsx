"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS: Record<string, string[]> = {
  MASYARAKAT: [
    "Siapa nama dan email saya?",
    "Status laporan saya apa saja?",
    "Notifikasi saya apa saja?",
  ],
  PETUGAS: [
    "Siapa nama dan email saya?",
    "Apa tugas saya?",
    "Berapa tugas yang belum selesai?",
  ],
  ADMIN: [
    "Siapa nama dan email saya?",
    "Berapa laporan yang menunggu verifikasi?",
    "Berapa laporan yang belum ditugaskan?",
  ],
};

const ROLE_LABELS: Record<string, string> = {
  MASYARAKAT: "Masyarakat",
  PETUGAS: "Petugas",
  ADMIN: "Admin",
};

export default function ChatbotWidget() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role ?? "MASYARAKAT";
  const roleLabel = ROLE_LABELS[role] ?? "Masyarakat";
  const quickQuestions = useMemo(
    () => QUICK_QUESTIONS[role] ?? QUICK_QUESTIONS.MASYARAKAT,
    [role]
  );
  const hasUserMessage = messages.some((m) => m.role === "user");

  // Sapaan mengikuti peran tempat chatbot dibuka.
  const greeting: Message = {
    role: "assistant",
    content: `Halo, saya chatbot ${roleLabel}.`,
  };
  const displayMessages = [greeting, ...messages];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  // Chatbot tersedia untuk semua pengguna yang sudah login.
  if (status !== "authenticated") {
    return null;
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      const reply =
        data?.reply ??
        "Maaf, saya tidak bisa menjawab saat ini. Coba lagi nanti.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Maaf, terjadi gangguan koneksi. Coba lagi nanti.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const displayQuestions = hasUserMessage ? [] : quickQuestions;

  return (
    <>
      {/* Tombol mengambang */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Buka chatbot asisten desa"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 flex items-center justify-center transition-all hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm h-[480px] max-h-[70vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">
                Chatbot {roleLabel}
              </p>
              <p className="text-xs text-blue-100 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                AI • NVIDIA NIM | {role}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup chatbot"
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pesan */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
            {displayMessages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center text-slate-500 text-sm">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
                <span>Asisten sedang mengetikk…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Pertanyaan cepat (hanya sebelum percakapan dimulai) */}
          {!loading && displayQuestions.length > 0 && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 bg-slate-50 border-t border-slate-100">
              {displayQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 p-3 border-t border-slate-200 bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pertanyaan…"
              maxLength={1000}
              disabled={loading}
              className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Kirim pesan"
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
