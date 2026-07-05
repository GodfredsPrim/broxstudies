import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { newsApi } from '@/api/endpoints'

const SEEN_KEY = 'news_last_seen_id'

/** True when a newer article exists than the last one the user viewed the
 * News & Updates page with — drives the sidebar nav dot. */
export function useNewsUnseen() {
  const location = useLocation()
  const [latestId, setLatestId] = useState<number | null>(null)
  const [seenId, setSeenId] = useState<string | null>(() => localStorage.getItem(SEEN_KEY))

  useEffect(() => {
    let active = true
    newsApi.list()
      .then(list => { if (active && list.length > 0) setLatestId(list[0].id) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (location.pathname === '/news' && latestId != null) {
      localStorage.setItem(SEEN_KEY, String(latestId))
      setSeenId(String(latestId))
    }
  }, [location.pathname, latestId])

  return latestId != null && String(latestId) !== seenId
}
