import { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  suffix?: string
  prefix?: string
  duration?: number
  className?: string
}

export function AnimatedCounter({ value, suffix = '', prefix = '', className }: AnimatedCounterProps) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 })
  const display = useTransform(spring, v => `${prefix}${Math.round(v).toLocaleString()}${suffix}`)
  const [text, setText] = useState(`${prefix}0${suffix}`)

  useEffect(() => {
    spring.set(value)
    const unsub = display.on('change', v => setText(v))
    return unsub
  }, [value, spring, display, prefix, suffix])

  return <motion.span className={className}>{text}</motion.span>
}
