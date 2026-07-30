export async function celebrateAchievement(kind: 'badge' | 'level' | 'streak' = 'badge') {
  try {
    const confetti = (await import('canvas-confetti')).default
    const colors = kind === 'streak'
      ? ['#FBBF24', '#F59E0B', '#FDE68A']
      : ['#55E2E7', '#2BC2D7', '#147FCA', '#0754B8']

    confetti({
      particleCount: kind === 'level' ? 120 : 80,
      spread: 70,
      origin: { y: 0.65 },
      colors,
      disableForReducedMotion: true,
    })
  } catch {
    /* optional enhancement */
  }
}
