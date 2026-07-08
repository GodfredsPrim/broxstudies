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
    // Very long answers: skip the reveal entirely — re-parsing thousands of
    // markdown+KaTeX characters dozens of times freezes low-end phones.
    if (!animate || content.length > 6000) {
      setVisible(content)
      onComplete?.()
      return
    }
    setVisible('')
    let i = 0
    // ~60 reveal frames at ~30fps: each frame re-parses the markdown, so
    // fewer/steadier frames beats a 16ms tick that saturates the main thread.
    const step = Math.max(1, Math.ceil(content.length / 60))
    const id = window.setInterval(() => {
      i = Math.min(content.length, i + step)
      setVisible(content.slice(0, i))
      if (i >= content.length) {
        clearInterval(id)
        onComplete?.()
      }
    }, 33)
    return () => clearInterval(id)
  }, [content, animate, live, onComplete])

  return (
    <div aria-live="polite" aria-atomic="false">
      <MarkdownMessage content={visible || '…'} />
    </div>
  )
}
