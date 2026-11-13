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
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Buka chatbot asisten"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 sm:bottom-6 sm:right-6"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[560px] max-h-[75vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40 sm:bottom-6 sm:right-6">
          <div className="flex items-center gap-3 border-b border-blue-500/20 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Asisten {roleLabel}</p>
              <p className="flex items-center gap-1.5 text-xs text-blue-100">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                CirebonLapor AI • Siap membantu
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup chatbot"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-4 py-4">
            {displayMessages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-1 ring-blue-200/60">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "rounded-bl-md border border-slate-200/80 bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <span>Asisten sedang mengetik…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!loading && displayQuestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-3 py-2.5">
              {displayQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pertanyaan Anda…"
              maxLength={1000}
              disabled={loading}
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Kirim pesan"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
