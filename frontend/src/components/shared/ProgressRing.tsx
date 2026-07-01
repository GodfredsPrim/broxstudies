import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface ProgressRingProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  className?: string
  color?: 'indigo' | 'emerald' | 'amber' | 'purple'
}

const COLORS = {
  indigo: { stroke: '#818CF8', glow: 'rgba(129,140,248,0.3)' },
  emerald: { stroke: '#34D399', glow: 'rgba(52,211,153,0.3)' },
  amber: { stroke: '#FBBF24', glow: 'rgba(251,191,36,0.3)' },
  purple: { stroke: '#A78BFA', glow: 'rgba(167,139,250,0.3)' },
}

export function ProgressRing({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  className,
  color = 'indigo',
}: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const c = COLORS[color]

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-3)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={c.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <span className="text-2xl font-bold text-foreground">{label}</span>}
        {sublabel && <span className="text-[11px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  )
}
