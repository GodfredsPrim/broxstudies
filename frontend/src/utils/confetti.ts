export async function celebrateAchievement(kind: 'badge' | 'level' | 'streak' = 'badge') {
  try {
    const confetti = (await import('canvas-confetti')).default
    const colors = kind === 'streak'
      ? ['#FBBF24', '#F59E0B', '#FDE68A']
      : ['#818CF8', '#A78BFA', '#6366F1', '#34D399']

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
