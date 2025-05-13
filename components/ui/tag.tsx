// src/components/ui/tag.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {}

const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600",
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)
Tag.displayName = "Tag"

export { Tag }
