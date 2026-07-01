import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[var(--bg-3)]',
        className,
      )}
      {...props}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
