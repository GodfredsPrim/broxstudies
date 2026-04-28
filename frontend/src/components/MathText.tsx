import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface Segment {
  type: 'text' | 'inline-math' | 'block-math' | 'image'
  content: string
}

// Chemical formula conversion: H2O → H₂O, CO2 → CO₂, etc.
function convertChemicalFormulas(text: string): string {
  return text
    // Convert subscripts in chemical formulas: H2O, CO2, C6H12O6
    .replace(/\b([A-Z][a-z]?)(\d+)(?=[A-Z]|\b)/g, (_, elem, num) =>
      elem + num.split('').map((d: string) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('')
    )
    // Superscript notation: ^2, ^3 outside LaTeX
    .replace(/\^(\d+)/g, (_, n) => n.split('').map((d: string) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join(''))
}

// Image URL pattern embedded in question text
const IMG_PATTERN = /\[image:\s*(https?:\/\/[^\]]+)\]/gi
const BLOCK_MATH_PATTERN = /\$\$([^$]+)\$\$/g
const INLINE_MATH_PATTERN = /\$([^$\n]+)\$/g

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Check block math $$...$$
    const blockMatch = BLOCK_MATH_PATTERN.exec(remaining)
    BLOCK_MATH_PATTERN.lastIndex = 0

    // Check inline math $...$
    const inlineMatch = INLINE_MATH_PATTERN.exec(remaining)
    INLINE_MATH_PATTERN.lastIndex = 0

    // Check image [image: url]
    const imgMatch = IMG_PATTERN.exec(remaining)
    IMG_PATTERN.lastIndex = 0

    // Find the earliest match
    const matches = [
      blockMatch && { type: 'block-math' as const, match: blockMatch },
      inlineMatch && { type: 'inline-math' as const, match: inlineMatch },
      imgMatch && { type: 'image' as const, match: imgMatch },
    ].filter(Boolean) as Array<{ type: Segment['type']; match: RegExpExecArray }>

    if (matches.length === 0) {
      segments.push({ type: 'text', content: convertChemicalFormulas(remaining) })
      break
    }

    matches.sort((a, b) => a.match.index - b.match.index)
    const earliest = matches[0]

    if (earliest.match.index > 0) {
      segments.push({
        type: 'text',
        content: convertChemicalFormulas(remaining.slice(0, earliest.match.index)),
      })
    }

    segments.push({ type: earliest.type, content: earliest.match[1] })
    remaining = remaining.slice(earliest.match.index + earliest.match[0].length)
  }

  return segments
}

function KatexSpan({ latex, block }: { latex: string; block: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      katex.render(latex, ref.current, {
        displayMode: block,
        throwOnError: false,
        output: 'html',
        trust: false,
      })
    } catch {
      if (ref.current) ref.current.textContent = latex
    }
  }, [latex, block])

  return (
    <span
      ref={ref}
      className={block ? 'my-2 block overflow-x-auto' : 'mx-0.5 inline-block align-middle'}
    />
  )
}

export function MathText({
  children,
  className = '',
}: {
  children: string
  className?: string
}) {
  if (!children) return null

  const segments = parseSegments(children)

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'block-math') {
          return <KatexSpan key={i} latex={seg.content} block />
        }
        if (seg.type === 'inline-math') {
          return <KatexSpan key={i} latex={seg.content} block={false} />
        }
        if (seg.type === 'image') {
          return (
            <img
              key={i}
              src={seg.content}
              alt="Question diagram"
              className="my-2 max-h-64 max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
              loading="lazy"
            />
          )
        }
        return <span key={i}>{seg.content}</span>
      })}
    </span>
  )
}

export function MathBlock({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <MathText>{children}</MathText>
    </div>
  )
}
