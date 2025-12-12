import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-md border p-4 text-[13px] [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-white border-[hsl(0,0%,92%)] text-[hsl(0,0%,32%)]",
        destructive:
          "border-[hsl(0,84%,90%)] text-[hsl(0,84%,45%)] bg-[hsl(0,84%,97%)] [&>svg]:text-[hsl(0,84%,45%)]",
        success:
          "border-[hsl(142,76%,90%)] text-[hsl(142,76%,30%)] bg-[hsl(142,76%,97%)] [&>svg]:text-[hsl(142,76%,36%)]",
        warning:
          "border-[hsl(44,100%,85%)] text-[hsl(44,100%,30%)] bg-[hsl(44,100%,96%)] [&>svg]:text-[hsl(44,100%,42%)]",
        info:
          "border-[hsl(210,100%,90%)] text-[hsl(210,100%,35%)] bg-[hsl(210,100%,97%)] [&>svg]:text-[hsl(210,100%,50%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-[13px] font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[12px] [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
