import { memo } from 'react'
import { MathText } from '@/components/MathText'
import { cn } from '@/lib/cn'

export interface ExamQuestion {
  question_text: string
  question_type?: string
  options?: string[]
  difficulty_level?: string
  correct_answer?: string
  explanation?: string
}

interface QuestionCardProps {
  index: number
  question: ExamQuestion
  answer?: string
  onAnswer?: (answer: string) => void
  answered?: boolean
  accentColor?: string
  accentTint?: string
  readOnly?: boolean
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-[var(--success-tint)] text-[var(--success)]',
  hard: 'bg-[var(--danger-tint)] text-[var(--danger)]',
  standard: 'bg-[var(--info-tint)] text-[var(--info)]',
  medium: 'bg-[var(--gold-tint)] text-[var(--gold)]',
}

function QuestionCardImpl({
  index,
  question,
  answer = '',
  onAnswer,
  answered = false,
  accentColor = 'var(--accent)',
  accentTint,
  readOnly = false,
}: QuestionCardProps) {
  const selectedTint = accentTint || 'var(--accent-tint)'
  const borderColor = answered ? accentColor : 'var(--line)'

  return (
    <article
      className="v2-card p-5 transition-colors"
      style={{ borderColor }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ backgroundColor: accentColor }}
        >
          {index + 1}
        </span>
        {question.difficulty_level && (
          <span
            className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold',
              DIFFICULTY_STYLES[question.difficulty_level] || DIFFICULTY_STYLES.medium,
            )}
          >
            {question.difficulty_level}
          </span>
        )}
      </div>

      <p className="text-sm font-medium leading-relaxed text-ink-0">
        <MathText>{question.question_text}</MathText>
      </p>

      {question.options?.length ? (
        <div className="mt-4 space-y-2">
          {question.options.map((opt, oi) => {
            const letter = String.fromCharCode(65 + oi)
            const isSelected = answer === opt
            return (
              <button
                key={oi}
                type="button"
                disabled={readOnly}
                onClick={() => onAnswer?.(opt)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition',
                  readOnly && 'cursor-default',
                  !readOnly && 'hover:border-[var(--line-strong)]',
                )}
                style={{
                  borderColor: isSelected ? accentColor : 'var(--line)',
                  backgroundColor: isSelected ? selectedTint : 'var(--bg-1)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: isSelected ? accentColor : 'var(--bg-3)',
                    color: isSelected ? '#fff' : 'var(--fg-2)',
                  }}
                >
                  {letter}
                </span>
                <MathText>{opt}</MathText>
              </button>
            )
          })}
        </div>
      ) : (
        <textarea
          value={answer}
          onChange={e => onAnswer?.(e.target.value)}
          readOnly={readOnly}
          placeholder="Write your answer here…"
          rows={readOnly ? 2 : 3}
          className="mt-4 block w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-sm text-ink-0 placeholder:text-ink-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
        />
      )}
    </article>
  )
}

/**
 * Memoized so answering one question doesn't re-render every other card
 * (each card carries KaTeX-rendered text). `onAnswer` is deliberately
 * excluded from the comparison: callers pass inline closures that only use
 * functional setState and per-slot constants, so a stale reference is safe.
 */
export const QuestionCard = memo(QuestionCardImpl, (prev, next) =>
  prev.question === next.question &&
  prev.answer === next.answer &&
  prev.answered === next.answered &&
  prev.index === next.index &&
  prev.readOnly === next.readOnly &&
  prev.accentColor === next.accentColor &&
  prev.accentTint === next.accentTint,
)
