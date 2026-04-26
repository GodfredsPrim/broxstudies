import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(30,58,138,0.14)] focus-visible:ring-offset-2 active:scale-[0.985] active:duration-100 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(23,46,110,0.2)] bg-[#1e3a8a] text-white shadow-[0_8px_20px_rgba(30,58,138,0.18)] hover:-translate-y-px hover:bg-[#172e6e] hover:shadow-[0_12px_24px_rgba(30,58,138,0.22)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_8px_20px_rgba(185,28,28,0.16)] hover:-translate-y-px hover:bg-destructive/90 hover:shadow-[0_12px_24px_rgba(185,28,28,0.2)]",
        outline:
          "border-slate-200/80 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-px hover:border-[rgba(30,58,138,0.14)] hover:bg-slate-50 hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)]",
        secondary:
          "border-slate-200/70 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-px hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)]",
        ghost: "text-slate-700 hover:-translate-y-px hover:bg-[rgba(30,58,138,0.08)] hover:text-slate-950",
        link: "text-primary underline-offset-4 hover:underline",
        ghana:
          "border-[rgba(23,46,110,0.2)] bg-[#1e3a8a] text-white shadow-[0_8px_20px_rgba(30,58,138,0.18)] hover:-translate-y-px hover:bg-[#172e6e] hover:shadow-[0_12px_24px_rgba(30,58,138,0.22)]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-10 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8",
        icon: "h-11 w-11",
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
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
