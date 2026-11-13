"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export default function NotificationDropdown() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;
    let activeController: AbortController | undefined;

    async function load(retries = 0) {
      // Cancel any in-flight request before starting a new one.
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const res = await fetch("/api/notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        const json = await res.json();
        if (controller.signal.aborted) return;

        if (!cancelled && json.success) {
          setNotifications(json.data);
          setUnreadCount(json.unreadCount);
        } else if (!cancelled) {
          throw new Error(json.message || "Gagal memuat notifikasi");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (cancelled) return;

        // Pertahankan data terakhir yang berhasil dimuat (stale data)
        // dan coba lagi dengan exponential backoff (maksimum 3 kali percobaan).
        if (retries < 3) {
          const backoffMs = Math.min(1000 * 2 ** retries, 10000);
          setTimeout(() => load(retries + 1), backoffMs);
        }

        console.error(
          "Gagal memuat notifikasi:",
          error instanceof Error ? error.message : "unknown_error"
        );
      }
    }

    load();
    // Polling setiap 30 detik
    const interval = setInterval(() => load(), 30000);
    return () => {
      cancelled = true;
      activeController?.abort();
      clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error(
        "Error marking as read:",
        error instanceof Error ? error.message : "unknown_error"
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Error marking all as read:",
        error instanceof Error ? error.message : "unknown_error"
      );
    }
  };

  if (!session?.user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label="Notifikasi"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/60 animate-in fade-in zoom-in-95 duration-150 sm:w-96 z-[var(--layout-z-dropdown)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
              <p className="text-xs text-slate-500">{unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
              >
                <Check className="h-3.5 w-3.5" /> Tandai semua
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">Belum ada notifikasi</p>
                <p className="mt-1 text-xs text-slate-500">Pembaruan aktivitas akan muncul di sini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3.5 transition-colors ${notif.isRead ? "bg-white hover:bg-slate-50/70" : "bg-blue-50/40 hover:bg-blue-50/60"}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1.5 shrink-0">
                        <span className={`block h-2 w-2 rounded-full ${notif.isRead ? "bg-slate-300" : "bg-blue-600"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${notif.isRead ? "text-slate-700" : "text-slate-900"}`}>{notif.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{notif.message}</p>
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(notif.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <div className="flex items-center gap-3">
                            {!notif.isRead && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="text-xs font-medium text-blue-600 hover:underline"
                              >
                                Tandai dibaca
                              </button>
                            )}
                            {notif.link && (
                              <Link
                                href={notif.link}
                                onClick={() => { if (!notif.isRead) markAsRead(notif.id); setIsOpen(false); }}
                                className="text-xs font-medium text-slate-700 hover:text-blue-600 hover:underline"
                              >
                                Lihat detail
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-center text-xs text-slate-400">
            Menampilkan hingga 20 notifikasi terbaru
          </div>
        </div>
      )}
    </div>
  );
}
