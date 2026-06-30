import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface FilterChipItem<T extends string = string> {
  id: T
  label: string
  icon?: ReactNode
  count?: number
}

interface FilterChipsProps<T extends string = string> {
  items: FilterChipItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}

export function FilterChips<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: FilterChipsProps<T>) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          data-active={value === item.id}
          onClick={() => onChange(item.id)}
          className="v2-chip !h-9 !px-3.5 !text-[12.5px]"
        >
          {item.icon}
          {item.label}
          {item.count !== undefined && (
            <span className="ml-0.5 font-mono text-[10px] opacity-70">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
