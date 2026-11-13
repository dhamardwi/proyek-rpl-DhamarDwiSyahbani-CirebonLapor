"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/20",
        secondary:
          "bg-white text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-50 hover:border-slate-300",
        outline:
          "border border-slate-200 bg-white/50 text-slate-700 hover:bg-white hover:border-slate-300",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        danger:
          "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700",
        success:
          "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700",
        warning:
          "bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs rounded-md",
        lg: "h-11 px-6 text-sm",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
