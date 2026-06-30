import type { ReactNode } from 'react'
import { PageHeader } from './PageHeader'
import { cn } from '@/lib/cn'

type PageWidth = 'narrow' | 'medium' | 'wide'

const widthClass: Record<PageWidth, string> = {
  narrow: 'page-narrow',
  medium: 'page-medium',
  wide: 'page-wide',
}

interface PageLayoutProps {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  width?: PageWidth
  children: ReactNode
  className?: string
  headerClassName?: string
  noHeaderBorder?: boolean
}

export function PageLayout({
  eyebrow,
  title,
  subtitle,
  actions,
  width = 'wide',
  children,
  className,
  headerClassName,
  noHeaderBorder,
}: PageLayoutProps) {
  return (
    <div className={cn('page-shell', widthClass[width], className)}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={actions}
        className={cn(noHeaderBorder && 'border-b-0 pb-4', headerClassName)}
      />
      {children}
    </div>
  )
}
