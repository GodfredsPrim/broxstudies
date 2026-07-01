import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { cn } from '@/lib/cn'

interface PerformanceChartProps {
  data?: { week: string; score: number }[]
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data && data.length > 0 ? data : [
    { week: 'W1', score: 0 },
    { week: 'W2', score: 0 },
  ]

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818CF8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#818CF8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-3)', fontSize: 12 }} />
        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-3)', fontSize: 12 }} width={30} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: '12px', fontSize: '13px' }}
          formatter={(v) => [`${v ?? 0}%`, 'Avg. Score']}
        />
        <Area type="monotone" dataKey="score" stroke="#818CF8" strokeWidth={2} fill="url(#areaGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const HEATMAP_WEEKS = 12
const HEATMAP_DAYS = 7
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function buildHeatmapFromEntries(entries: { created_at: string }[]) {
  const grid: { week: number; day: number; value: number }[] = []
  const counts = new Map<string, number>()

  for (const e of entries) {
    const d = new Date(e.created_at)
    const key = d.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    for (let d = 0; d < HEATMAP_DAYS; d++) {
      const date = new Date()
      date.setDate(date.getDate() - ((HEATMAP_WEEKS - 1 - w) * 7 + (6 - d)))
      const key = date.toISOString().slice(0, 10)
      const count = counts.get(key) || 0
      grid.push({ week: w, day: d, value: Math.min(4, count) })
    }
  }
  return grid
}

interface StudyHeatmapProps {
  entries?: { created_at: string }[]
}

export function StudyHeatmap({ entries = [] }: StudyHeatmapProps) {
  const heatmap = entries.length > 0
    ? buildHeatmapFromEntries(entries)
    : Array.from({ length: HEATMAP_WEEKS * HEATMAP_DAYS }, (_, i) => ({
        week: Math.floor(i / HEATMAP_DAYS),
        day: i % HEATMAP_DAYS,
        value: 0,
      }))

  const getColor = (v: number) => {
    if (v === 0) return 'bg-[var(--bg-3)]'
    if (v === 1) return 'bg-indigo-500/20'
    if (v === 2) return 'bg-indigo-500/40'
    if (v === 3) return 'bg-indigo-500/60'
    return 'bg-indigo-500/80'
  }

  return (
    <div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-2 pt-5">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="grid h-3 w-3 place-items-center text-[9px] text-muted-foreground">{d}</span>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {Array.from({ length: HEATMAP_WEEKS }, (_, w) => (
            <div key={w} className="flex flex-col gap-1">
              {Array.from({ length: HEATMAP_DAYS }, (_, d) => {
                const cell = heatmap.find(c => c.week === w && c.day === d)
                return (
                  <div
                    key={d}
                    className={cn('h-3 w-3 rounded-sm transition-colors', getColor(cell?.value || 0))}
                    title={`${cell?.value || 0} sessions`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(v => (
          <div key={v} className={cn('h-3 w-3 rounded-sm', getColor(v))} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
