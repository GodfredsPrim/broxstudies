import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leading?: ReactNode
  trailing?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const variantCls: Record<Variant, string> = {
  primary: 'v2-btn v2-btn-primary',
  ghost: 'v2-btn v2-btn-ghost',
  subtle: 'v2-btn v2-btn-subtle',
  danger:
    'v2-btn border-transparent bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200',
}

const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'ghost', size = 'md', leading, trailing, loading, fullWidth, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(variantCls[variant], sizeCls[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/20 border-t-current" />
      ) : (
        leading
      )}
      {children}
      {!loading && trailing}
    </button>
  )
})
