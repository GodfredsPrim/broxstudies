import { useCallback, useEffect, useState } from 'react'
import { useGamification } from '@/hooks/useGamification'

const ALERT_DAY_KEY = 'brox.alerts.last-study-reminder'

export function useAppAlerts() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [permission, setPermission] = useState<NotificationPermission>(() => supported ? Notification.permission : 'denied')
  const { streak, dailyMinutesStudied, dailyGoalMinutes } = useGamification()

  const notify = useCallback((title: string, body: string) => {
    if (!supported || Notification.permission !== 'granted') return
    const notification = new Notification(title, { body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png', tag: 'brox-study-alert' })
    notification.onclick = () => { window.focus(); window.location.assign('/dashboard'); notification.close() }
  }, [supported])

  const enableAlerts = useCallback(async () => {
    if (!supported) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') notify('BroxStudies alerts are on', 'We will remind you about your study goal, streak, news, and important updates.')
    return result === 'granted'
  }, [notify, supported])

  useEffect(() => {
    if (permission !== 'granted') return
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    if (now.getHours() >= 18 && dailyMinutesStudied < dailyGoalMinutes && localStorage.getItem(ALERT_DAY_KEY) !== today) {
      notify(
        streak > 0 ? `Keep your ${streak}-day streak alive` : 'Make today count',
        `You have ${Math.max(0, dailyGoalMinutes - dailyMinutesStudied)} minutes left in today's study goal.`,
      )
      localStorage.setItem(ALERT_DAY_KEY, today)
    }
  }, [dailyGoalMinutes, dailyMinutesStudied, notify, permission, streak])

  return { supported, permission, enableAlerts, notify }
}
