import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/shadcn-card'
import { Eyebrow } from '@/components/ui/Eyebrow'

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="v2-mesh" style={{ opacity: 0.5 }} />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Link to="/welcome" className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-glow-sm">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="text-lg font-bold leading-none">BroxStudies</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">SHS & TVET</div>
          </div>
        </Link>

        <Card className="overflow-hidden">
          <div className="relative p-7 sm:p-9">
            <Eyebrow className="mb-3 block">{eyebrow}</Eyebrow>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
