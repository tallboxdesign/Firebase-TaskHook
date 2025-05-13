import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Claude-inspired priority variants
        "high-claude": "bg-rose-50 text-rose-500 border-transparent", // px-3 py-1 from example
        "medium-claude": "bg-amber-50 text-amber-600 border-transparent", // px-3 py-1 from example
        "low-claude": "bg-emerald-50 text-emerald-600 border-transparent", // px-3 py-1 from example
        "default-claude": "bg-slate-100 text-slate-600 border-transparent", // px-3 py-1 from example
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  // Adjust padding for Claude variants based on original spec
  const isClaudeVariant = variant && ['high-claude', 'medium-claude', 'low-claude', 'default-claude'].includes(variant);
  const claudePadding = isClaudeVariant ? "px-3 py-1" : "";

  return (
    <div className={cn(badgeVariants({ variant }), claudePadding, className)} {...props} />
  )
}

export { Badge, badgeVariants }
