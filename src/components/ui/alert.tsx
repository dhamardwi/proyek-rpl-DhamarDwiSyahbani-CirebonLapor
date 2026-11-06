"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-3.5 [&>svg]:top-4 [&>svg]:text-slate-400 [&>svg+div]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-slate-50 border-slate-200 text-slate-900",
        destructive: "bg-red-50 border-red-200 text-red-700 [&>svg]:text-red-500",
        success: "bg-green-50 border-green-200 text-green-700 [&>svg]:text-green-500",
        warning: "bg-amber-50 border-amber-200 text-amber-700 [&>svg]:text-amber-500",
        info: "bg-blue-50 border-blue-200 text-blue-700 [&>svg]:text-blue-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
);
AlertTitle.displayName = AlertTitle.displayName;

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
);
AlertDescription.displayName = AlertDescription.displayName;

export { Alert, AlertTitle, AlertDescription };
