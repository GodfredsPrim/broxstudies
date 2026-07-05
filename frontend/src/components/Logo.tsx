import { cn } from '@/lib/cn'

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn('relative grid shrink-0 place-items-center overflow-hidden shadow-glow-sm', className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
      }}
    >
      <span
        className="relative font-display font-bold text-white"
        style={{ fontSize: size * 0.42, lineHeight: 1 }}
      >
        Bx
      </span>
    </div>
  )
}

export function Logo({
  size = 36,
  subtitle,
  className,
}: {
  size?: number
  subtitle?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <LogoMark size={size} />
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold leading-none text-[var(--fg-0)]">BroxStudies</div>
        {subtitle && (
          <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
