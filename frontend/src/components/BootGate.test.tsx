// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BootGate } from '@/components/BootGate'
import { systemApi } from '@/api/endpoints'

vi.mock('@/api/endpoints', () => ({
  systemApi: {
    loadingProgress: vi.fn(),
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ loading: false }),
}))

describe('BootGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(systemApi.loadingProgress).mockResolvedValue({
      is_loading: false,
      progress_percentage: 100,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not mount interactive app content behind the splash', async () => {
    render(
      <BootGate>
        <textarea aria-label="Tutor message" />
      </BootGate>,
    )

    expect(screen.queryByLabelText('Tutor message')).toBeNull()

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(449)
    })
    expect(screen.queryByLabelText('Tutor message')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByLabelText('Tutor message')).toBeTruthy()
    expect(screen.queryByLabelText('Preparing BroxStudies')).toBeNull()
  })
})
