"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
