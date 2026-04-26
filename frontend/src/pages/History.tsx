import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock, User, Bot } from 'lucide-react'
import { tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

interface Message {
  id: number | string
  role: 'user' | 'ai'
  content: string
  created_at?: string
}

export function HistoryPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setMessages([])
      setError('')
      return
    }

    let active = true
    const load = async () => {
      setError('')
      try {
        const data = await tutorApi.history(50)
        if (active) setMessages(data.messages || [])
      } catch (err) {
        if (active) setError(extractError(err, 'Failed to load history.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
        <div className="mt-10 text-center">
          <div className="pulse-loader mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">History</h1>
        <p className="mt-2 text-muted-foreground">Your conversation history with the AI tutor.</p>
      </div>

      <div className="mt-10">
        {!user ? (
          <div className="text-center py-20">
            <Clock size={48} className="mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Sign in to view your AI tutor conversation history.</p>
            <Link to="/login" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Sign in
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
            <p>{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <Clock size={48} className="mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No history yet. Start chatting to see your conversations here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`p-4 rounded-lg border ${
                msg.role === 'user' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {msg.role === 'user' ? (
                    <User size={16} className="text-blue-600" />
                  ) : (
                    <Bot size={16} className="text-gray-600" />
                  )}
                  <span className="text-sm font-semibold capitalize text-muted-foreground">
                    {msg.role === 'user' ? 'You' : 'AI Tutor'}
                  </span>
                  {msg.created_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-foreground">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}