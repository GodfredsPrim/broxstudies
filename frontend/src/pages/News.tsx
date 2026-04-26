import { useState, useEffect } from 'react'
import { Megaphone } from 'lucide-react'
import { competitionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import type { Competition } from '@/api/types'

export function NewsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setError('')
      try {
        const data = await competitionsApi.list()
        if (active) setCompetitions(data)
      } catch (err) {
        if (active) setError(extractError(err, 'Failed to load announcements.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
        <div className="mt-10 text-center">
          <div className="pulse-loader mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading announcements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">News & Updates</h1>
        <p className="mt-2 text-muted-foreground">Latest competitions and announcements from BroxStudies.</p>
      </div>

      {error && (
        <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-10">
        {competitions.length === 0 ? (
          <div className="text-center py-20">
            <Megaphone size={48} className="mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No announcements yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {competitions.map(comp => (
              <div key={comp.id} className="p-6 rounded-lg border bg-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground">{comp.title}</h3>
                    <p className="mt-2 text-muted-foreground">{comp.description}</p>
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Starts: {new Date(comp.start_date).toLocaleDateString()}</span>
                      <span>Ends: {new Date(comp.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm font-semibold text-foreground">Prize</div>
                    <div className="text-lg font-bold text-emerald-600">{comp.prize}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    comp.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {comp.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}