import { useEffect, useRef, useState } from 'react'
import { authApi } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { extractError } from '@/api/client'
import type { AuthUser } from '@/api/types'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

let scriptLoadPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google sign-in'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

export function GoogleSignInButton({
  clientId,
  onSignedIn,
  onError,
}: {
  clientId: string
  onSignedIn: (user: AuthUser) => void
  onError: (message: string) => void
}) {
  const { signIn } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              const res = await authApi.google({ credential: response.credential })
              signIn(res.access_token, res.user)
              onSignedIn(res.user)
            } catch (err) {
              onError(extractError(err, 'Could not sign in with Google.'))
            }
          },
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          shape: 'pill',
          text: 'continue_with',
        })
        if (!cancelled) setReady(true)
      })
      .catch(() => { if (!cancelled) onError('Could not load Google sign-in.') })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  return (
    <div className="flex justify-center">
      <div ref={containerRef} className={ready ? '' : 'h-11 w-full animate-pulse rounded-full bg-[var(--bg-2)]'} />
    </div>
  )
}
