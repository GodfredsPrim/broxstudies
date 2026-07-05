import { motion } from 'framer-motion'

const IMAGES = [
  '/images/students-assembly.jpg',
  '/images/students-championship.jpg',
  '/images/students-quiz-team.jpg',
  '/images/students-girls-shs.jpg',
]

/** Slow, subtle Ken-Burns photo texture sitting behind the page's `.v2-mesh`
 * gradient — low opacity + blur + fade-to-background so it reads as ambient
 * texture, not a distracting photo, and never competes with foreground text. */
export function PhotoBackdrop({ image, seed = 0 }: { image?: string; seed?: number }) {
  const src = image || IMAGES[seed % IMAGES.length]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.img
        src={src}
        alt=""
        aria-hidden="true"
        initial={{ scale: 1.08, x: 0, y: 0 }}
        animate={{ scale: [1.08, 1.16, 1.08], x: [0, -12, 0], y: [0, 8, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
        className="h-full w-full object-cover opacity-40 grayscale-[15%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-0)] via-[var(--bg-0)]/40 to-[var(--bg-0)]/70" />
      <div className="absolute inset-0 bg-[var(--bg-0)]/20" />
    </div>
  )
}
