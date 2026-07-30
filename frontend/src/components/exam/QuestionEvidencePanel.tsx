import { BookOpenCheck, ChevronDown, ShieldCheck } from 'lucide-react'
import type { QuestionEvidence } from '@/api/types'

const DISCLAIMER = 'This is an independently generated study question, not a leaked or guaranteed examination question. Learners should verify it against official curriculum and examination materials.'

interface Props {
  evidence?: QuestionEvidence
  difficulty?: string
}

export function QuestionEvidencePanel({ evidence, difficulty }: Props) {
  const item: QuestionEvidence = evidence || {
    curriculum_strand: 'Curriculum alignment pending',
    curriculum_sub_strand: 'Sub-strand not captured',
    learning_outcome: 'Learning outcome mapping pending',
    source_document: 'Source document not captured',
    source_excerpt: 'No verbatim source excerpt was retained for this generated item.',
    historical_exam_pattern: 'No historical pattern was recorded for this item.',
    question_difficulty: difficulty || 'standard',
    marks: 1,
    confidence_explanation: 'Confidence is limited because complete provenance was not retained.',
    verification_status: 'unverified',
    academic_disclaimer: DISCLAIMER,
  }

  return (
    <details className="mt-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-2)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[var(--fg-1)]">
        <BookOpenCheck size={14} className="text-[var(--primary)]" />
        Curriculum evidence
        <span className="ml-auto rounded-full bg-[var(--primary-tint)] px-2 py-0.5 text-[10px] text-[var(--primary-strong)]">
          {item.marks} {item.marks === 1 ? 'mark' : 'marks'}
        </span>
        <ChevronDown size={13} />
      </summary>
      <div className="grid gap-3 border-t border-[var(--line)] p-3 text-xs sm:grid-cols-2">
        <Evidence label="Curriculum strand" value={item.curriculum_strand} />
        <Evidence label="Sub-strand" value={item.curriculum_sub_strand} />
        <Evidence label="Learning outcome" value={item.learning_outcome} wide />
        <Evidence label="Source document" value={item.source_document} />
        <Evidence label="Source excerpt" value={item.source_excerpt} wide quote />
        <Evidence label="Historical examination pattern" value={item.historical_exam_pattern} wide />
        <Evidence label="Difficulty" value={item.question_difficulty} />
        <Evidence label="Marks" value={String(item.marks)} />
        <Evidence label="Confidence explanation" value={item.confidence_explanation} wide />
        <div className="sm:col-span-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--fg-3)]">Verification status</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
            item.verification_status === 'verified'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <ShieldCheck size={12} /> {item.verification_status.replaceAll('_', ' ')}
          </span>
        </div>
        <p className="sm:col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 leading-relaxed text-[var(--fg-2)]">
          <span className="font-semibold">Academic disclaimer: </span>{item.academic_disclaimer}
        </p>
      </div>
    </details>
  )
}

function Evidence({ label, value, wide = false, quote = false }: { label: string; value: string; wide?: boolean; quote?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--fg-3)]">{label}</span>
      <p className={quote ? 'border-l-2 border-[var(--primary)] pl-2 italic leading-relaxed text-[var(--fg-2)]' : 'leading-relaxed text-[var(--fg-1)]'}>
        {value}
      </p>
    </div>
  )
}
