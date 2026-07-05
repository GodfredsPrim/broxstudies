const IMAGES = [
  '/images/students-assembly.jpg',
  '/images/students-championship.jpg',
  '/images/students-quiz-team.jpg',
  '/images/students-girls-shs.jpg',
]

/** Static photo texture sitting behind the page's `.v2-mesh` gradient — low
 * opacity + fade-to-background so it reads as ambient texture, not a
 * distracting photo. Deliberately not animated: a continuous transform +
 * grayscale-filter animation here defeated GPU layer promotion on lower-end
 * mobile browsers, forcing a full-screen repaint every frame and causing the
 * page to stutter while typing or scrolling. */
export function PhotoBackdrop({ image, seed = 0 }: { image?: string; seed?: number }) {
  const src = image || IMAGES[seed % IMAGES.length]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="h-full w-full scale-105 object-cover opacity-40 grayscale-[15%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-0)] via-[var(--bg-0)]/40 to-[var(--bg-0)]/70" />
      <div className="absolute inset-0 bg-[var(--bg-0)]/20" />
    </div>
  )
}
