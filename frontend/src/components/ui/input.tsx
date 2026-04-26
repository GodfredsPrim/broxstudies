import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode
  trailing?: ReactNode
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, invalid, ...rest },
  ref,
) {
  if (leading || trailing) {
    return (
      <div
        className={cn(
          'v2-input flex h-11 items-center gap-2 px-3',
          invalid && 'border-rose-400/40 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]',
          className,
        )}
      >
        {leading && <span className="text-ink-400">{leading}</span>}
        <input
          ref={ref}
          className="h-full flex-1 border-0 bg-transparent p-0 text-sm font-medium text-ink-0 placeholder:text-ink-400 focus:outline-none"
          {...rest}
        />
        {trailing && <span className="text-ink-400">{trailing}</span>}
      </div>
    )
  }
  return (
    <input
      ref={ref}
      className={cn(
        'v2-input',
        invalid && 'border-rose-400/40 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]',
        className,
      )}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'v2-input block min-h-[96px] py-3 leading-relaxed',
          className,
        )}
        {...rest}
      />
    )
  },
)
