"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full min-h-[96px] rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
