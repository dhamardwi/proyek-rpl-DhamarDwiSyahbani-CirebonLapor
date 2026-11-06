"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Clock, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        const json = await res.json();
        if (!cancelled && json.success) {
          setNotifications(json.data);
          setUnreadCount(json.unreadCount);
        }
      } catch (error) {
        console.error("Gagal memuat notifikasi", error);
      }
    }
    load();
    // Polling setiap 30 detik
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read", error);
    }
  };

  if (!session?.user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          <Card className="border-0 bg-slate-50/50 p-0">
            <CardHeader className="pb-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Notifikasi
                </CardTitle>
                {unreadCount > 0 && (
                  <Button
                    onClick={markAllAsRead}
                    size="sm"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1.5"
                  >
                    <Check className="w-3 h-3" /> Tandai semua dibaca
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">Belum ada notifikasi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-4 transition-colors ${notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                      >
                        <div className="flex gap-3">
                          <div className="shrink-0 mt-1">
                            <div className={`w-2 h-2 rounded-full ${notif.isRead ? 'bg-slate-300' : 'bg-blue-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold mb-1 ${notif.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                              {notif.title}
                            </h4>
                            <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(notif.createdAt).toLocaleDateString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              
                              <div className="flex gap-2">
                                {!notif.isRead && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      markAsRead(notif.id);
                                    }}
                                    className="text-xs text-blue-600 font-medium hover:underline"
                                  >
                                    Tandai dibaca
                                  </button>
                                )}
                                {notif.link && (
                                  <Link 
                                    href={notif.link}
                                    onClick={() => markAsRead(notif.id)}
                                    className="text-xs text-slate-700 font-medium hover:underline flex items-center"
                                  >
                                    Lihat Detail
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
              <div className="p-3 text-center border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400">Menampilkan hingga 20 notifikasi terbaru</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
