import { cn } from '@/lib/cn'
import { useId } from 'react'

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gradientId = `brox-mark-${useId().replace(/:/g, '')}`
  const highlightId = `${gradientId}-highlight`
  const shineId = `${gradientId}-shine`
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={cn('shrink-0 overflow-visible drop-shadow-[0_8px_20px_var(--accent-glow)]', className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id={gradientId} x1="430" y1="40" x2="74" y2="466" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#55E2E7" />
          <stop offset="0.38" stopColor="#147FCA" />
          <stop offset="0.7" stopColor="#083578" />
          <stop offset="1" stopColor="#010433" />
        </linearGradient>
        <linearGradient id={highlightId} x1="374" y1="58" x2="184" y2="322" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={shineId} x1="98" y1="74" x2="410" y2="448" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.78" />
          <stop offset="0.48" stopColor="#8DEDF1" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="496" height="496" rx="140" fill={`url(#${gradientId})`} />
      <path d="M64 198C64 112 133 44 219 44h162c37 0 67 30 67 67v16C273 127 134 235 72 390c-6-22-8-46-8-72V198Z" fill={`url(#${highlightId})`} />
      <rect x="13" y="13" width="486" height="486" rx="135" fill="none" stroke={`url(#${shineId})`} strokeWidth="10" />
      <text
        x="256"
        y="336"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="252"
        fontWeight="800"
        letterSpacing="-24"
        textAnchor="middle"
      >
        Bx
      </text>
    </svg>
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
        <div className="brand-wordmark truncate font-display text-[19px] font-extrabold leading-none tracking-[-0.04em]">BroxStudies</div>
        {subtitle && (
          <div className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
