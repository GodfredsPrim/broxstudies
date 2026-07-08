import { useState, type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/shared/Skeleton'

interface SmoothImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string
}

/** Image that fades in once loaded instead of popping in, with a skeleton
 * placeholder underneath so the layout never jumps while news images load. */
export function SmoothImage({ wrapperClassName, className, onLoad, ...props }: SmoothImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={cn('relative overflow-hidden', wrapperClassName)}>
      {!loaded && <Skeleton className={cn('absolute inset-0 rounded-none', className)} />}
      <img
        {...props}
        className={cn('transition-opacity duration-500 ease-out', loaded ? 'opacity-100' : 'opacity-0', className)}
        onLoad={e => {
          setLoaded(true)
          onLoad?.(e)
        }}
      />
    </div>
  )
}
