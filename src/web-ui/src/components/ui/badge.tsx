import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(235,69%,61%)] text-white",
        secondary:
          "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,32%)]",
        destructive:
          "bg-[hsl(0,84%,95%)] text-[hsl(0,84%,45%)]",
        success:
          "bg-[hsl(142,76%,94%)] text-[hsl(142,76%,30%)]",
        warning:
          "bg-[hsl(44,100%,94%)] text-[hsl(44,100%,30%)]",
        outline: 
          "border border-[hsl(0,0%,90%)] text-[hsl(0,0%,46%)] bg-transparent",
        // Status-specific variants
        backlog:
          "bg-[hsl(0,0%,94%)] text-[hsl(0,0%,46%)]",
        planned:
          "bg-[hsl(210,100%,95%)] text-[hsl(210,100%,45%)]",
        "in-progress":
          "bg-[hsl(44,100%,94%)] text-[hsl(44,100%,35%)]",
        completed:
          "bg-[hsl(142,76%,94%)] text-[hsl(142,76%,30%)]",
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
