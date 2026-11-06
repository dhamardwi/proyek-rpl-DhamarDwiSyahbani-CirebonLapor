"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  const styles = {
    success: "bg-green-50 border border-green-200 text-green-700",
    error: "bg-red-50 border border-red-200 text-red-700",
    info: "bg-blue-50 border border-blue-200 text-blue-700",
  };

  React.useEffect(() => {
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200",
        styles[type]
      )}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="ml-2 shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Tutup notifikasi"
      >
        <span className="sr-only">Tutup</span>
        <span className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-100">
          <span className="sr-only">✕</span>
        </span>
      </button>
    </div>
  );
}
