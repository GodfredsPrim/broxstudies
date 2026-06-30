export interface GradeStyle {
  label: string
  color: string
  bg: string
}

export function gradeInfo(pct: number): GradeStyle {
  if (pct >= 80) {
    return {
      label: 'Excellent',
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50',
    }
  }
  if (pct >= 65) {
    return {
      label: 'Good',
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50',
    }
  }
  if (pct >= 50) {
    return {
      label: 'Fair',
      color: 'text-yellow-700 dark:text-yellow-400',
      bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/50',
    }
  }
  return {
    label: 'Needs Work',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50',
  }
}
