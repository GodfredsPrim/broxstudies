import type { ReactNode } from 'react'
import { Card } from './card'

interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-4 py-14 text-center" grain>
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20">
          {icon}
        </div>
      )}
      <div className="max-w-md space-y-2 px-4">
        <h3 className="font-display text-2xl text-ink-0">{title}</h3>
        {body && <p className="text-sm leading-relaxed text-ink-300">{body}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </Card>
  )
}
