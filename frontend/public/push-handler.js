self.addEventListener('push', event => {
  let data = { title: 'BroxStudies', body: 'You have a new study update.', url: '/dashboard' }
  try { data = { ...data, ...event.data.json() } } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png', data: { url: data.url }, tag: 'brox-study-alert' }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const target = event.notification.data?.url || '/dashboard'
    const existing = windows.find(client => 'focus' in client)
    return existing ? existing.focus().then(() => existing.navigate(target)) : clients.openWindow(target)
  }))
})
