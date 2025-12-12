import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[hsl(0,0%,90%)] bg-white px-3 py-2 text-[13px] text-[hsl(0,0%,9%)] ring-offset-white placeholder:text-[hsl(0,0%,56%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(235,69%,61%)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
