import { useCallback, useEffect, useState } from 'react'
import { useGamification } from '@/hooks/useGamification'
import { learningApi } from '@/api/endpoints'

const ALERT_DAY_KEY = 'brox.alerts.last-study-reminder'
const REVIEW_ALERT_KEY = 'brox.alerts.last-review-reminder'
const decodeVapidKey = (value: string) => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

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
    if (result === 'granted') {
      notify('BroxStudies alerts are on', 'We will remind you about your study goal, streak, news, and important updates.')
      try {
        const config = await learningApi.pushConfig()
        if (config.enabled && 'serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready
          const existing = await registration.pushManager.getSubscription()
          const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(config.public_key) })
          await learningApi.subscribePush(subscription.toJSON())
        }
      } catch { /* Local reminders remain active when push setup is unavailable. */ }
    }
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

  useEffect(() => {
    if (permission !== 'granted') return
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(REVIEW_ALERT_KEY) === today) return
    learningApi.overview().then(overview => {
      if (overview.due_reviews.length > 0) {
        notify('Your next review is ready', `${overview.due_reviews.length} weak topic${overview.due_reviews.length === 1 ? '' : 's'} need a short spaced review today.`)
        localStorage.setItem(REVIEW_ALERT_KEY, today)
      } else {
        const todaySession = overview.plan.find(item => item.plan_date === today && !item.completed)
        if (todaySession) {
          notify(`Today: ${todaySession.subject}`, `${todaySession.minutes} minutes of ${todaySession.activity.toLowerCase()} on ${todaySession.topic}.`)
          localStorage.setItem(REVIEW_ALERT_KEY, today)
        }
      }
    }).catch(() => {})
  }, [notify, permission])

  return { supported, permission, enableAlerts, notify }
}
