import { useEffect, useState } from 'react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'

interface StreamingMessageProps {
  content: string
  animate?: boolean
  live?: boolean
  onComplete?: () => void
}

export function StreamingMessage({ content, animate = true, live = false, onComplete }: StreamingMessageProps) {
  const [visible, setVisible] = useState(animate && !live ? '' : content)

  useEffect(() => {
    if (live) {
      setVisible(content)
      return
    }
    if (!animate) {
      setVisible(content)
      onComplete?.()
      return
    }
    setVisible('')
    let i = 0
    const step = Math.max(1, Math.floor(content.length / 120))
    const id = window.setInterval(() => {
      i = Math.min(content.length, i + step)
      setVisible(content.slice(0, i))
      if (i >= content.length) {
        clearInterval(id)
        onComplete?.()
      }
    }, 16)
    return () => clearInterval(id)
  }, [content, animate, live, onComplete])

  return (
    <div aria-live="polite" aria-atomic="false">
      <MarkdownMessage content={visible || '…'} />
    </div>
  )
}
