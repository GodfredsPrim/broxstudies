import { motion } from 'framer-motion'
import {
  Sparkles, Calculator, FlaskConical, BookOpen, PenLine, Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const PROMPTS = [
  { text: 'Explain quadratic equations step by step', icon: Calculator, category: 'Math' },
  { text: 'What is the difference between ionic and covalent bonding?', icon: FlaskConical, category: 'Science' },
  { text: 'Help me write a WASSCE essay introduction', icon: PenLine, category: 'English' },
  { text: 'Summarize the causes of World War II for Social Studies', icon: BookOpen, category: 'History' },
  { text: 'Solve this past paper question with full working', icon: Sparkles, category: 'Practice' },
  { text: 'Attach a photo of a question for step-by-step help', icon: ImageIcon, category: 'Upload' },
]

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function SuggestedPrompts({ onSelect, disabled }: SuggestedPromptsProps) {
  return (
    <div className="mt-8">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Try asking
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROMPTS.map((p, i) => (
          <motion.button
            key={p.text}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.35 }}
            disabled={disabled}
            onClick={() => onSelect(p.text)}
            className={cn(
              'group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all',
              'hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:shadow-glow-sm',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/20">
              <p.icon size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{p.category}</span>
              <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{p.text}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
