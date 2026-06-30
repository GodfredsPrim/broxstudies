import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-11 w-11 border-[3px]',
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <div
      className={cn('inline-flex flex-col items-center gap-3', className)}
      role="status"
      aria-label={label || 'Loading'}
    >
      <div
        className={cn(
          'animate-spin rounded-full border-[var(--line-strong)] border-t-[var(--accent)]',
          sizes[size],
        )}
      />
      {label && <p className="text-sm text-ink-400">{label}</p>}
    </div>
  )
}
