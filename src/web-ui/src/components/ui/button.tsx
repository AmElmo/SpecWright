import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary - Linear's signature violet
        default: "bg-[hsl(235,69%,61%)] text-white hover:bg-[hsl(235,69%,55%)] focus-visible:ring-[hsl(235,69%,61%)]",
        
        // Success - Muted green
        success: "bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,32%)] focus-visible:ring-[hsl(142,76%,36%)]",
        
        // Danger - Muted red
        destructive: "bg-[hsl(0,84%,60%)] text-white hover:bg-[hsl(0,84%,55%)] focus-visible:ring-[hsl(0,84%,60%)]",
        
        // Warning - Muted orange
        warning: "bg-[hsl(25,95%,53%)] text-white hover:bg-[hsl(25,95%,48%)] focus-visible:ring-[hsl(25,95%,53%)]",
        
        // Outline - Subtle border style
        outline: "border border-[hsl(0,0%,90%)] bg-white text-[hsl(0,0%,32%)] hover:bg-[hsl(0,0%,98%)] hover:border-[hsl(0,0%,85%)] focus-visible:ring-[hsl(0,0%,70%)]",
        
        // Ghost - Transparent with hover state
        ghost: "text-[hsl(0,0%,32%)] hover:bg-[hsl(0,0%,96%)] focus-visible:ring-[hsl(0,0%,70%)]",
        
        // Secondary - Subtle gray background
        secondary: "bg-[hsl(0,0%,96%)] text-[hsl(0,0%,32%)] hover:bg-[hsl(0,0%,93%)] focus-visible:ring-[hsl(0,0%,70%)]",
        
        // Link - No background, just text
        link: "text-[hsl(235,69%,61%)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[12px]",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
