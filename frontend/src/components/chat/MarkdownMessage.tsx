import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MathText } from '@/components/MathText'
import { cn } from '@/lib/cn'

interface MarkdownMessageProps {
  content: string
  className?: string
}

function flattenChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(flattenChildren).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return flattenChildren((children as React.ReactElement).props.children)
  }
  return ''
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={cn('max-w-none text-[14.5px] leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-2">
              <MathText>{flattenChildren(children)}</MathText>
            </p>
          ),
          li: ({ children }) => (
            <li className="my-0.5">
              <MathText>{flattenChildren(children)}</MathText>
            </li>
          ),
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          h1: ({ children }) => <h3 className="my-3 text-base font-bold"><MathText>{flattenChildren(children)}</MathText></h3>,
          h2: ({ children }) => <h4 className="my-2 text-sm font-bold"><MathText>{flattenChildren(children)}</MathText></h4>,
          h3: ({ children }) => <h5 className="my-2 text-sm font-semibold"><MathText>{flattenChildren(children)}</MathText></h5>,
          code: ({ className: cls, children }) => {
            const isBlock = cls?.includes('language-')
            if (isBlock) {
              return (
                <pre className="my-3 overflow-x-auto rounded-xl bg-[var(--bg-3)] p-4">
                  <code className="font-mono text-xs">{children}</code>
                </pre>
              )
            }
            return (
              <code className="rounded-md bg-[var(--bg-3)] px-1.5 py-0.5 font-mono text-[13px]">{children}</code>
            )
          },
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
