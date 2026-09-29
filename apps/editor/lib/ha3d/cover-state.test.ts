import { describe, expect, test } from 'bun:test'
import {
  resolveCoverOpenOffset,
  resolveHomeAssistantCoverOpenFraction,
  stepCoverOffset,
} from './cover-state'

describe('Home Assistant cover state', () => {
  test('maps current_position to an open fraction', () => {
    expect(
      resolveHomeAssistantCoverOpenFraction({
        entityId: 'cover.salon',
        state: 'open',
        attributes: { current_position: 42 },
      }),
    ).toBe(0.42)
  })

  test('falls back to the cover state when position is absent', () => {
    expect(
      resolveHomeAssistantCoverOpenFraction({
        entityId: 'cover.salon',
        state: 'open',
        attributes: {},
      }),
    ).toBe(1)
    expect(
      resolveHomeAssistantCoverOpenFraction({
        entityId: 'cover.salon',
        state: 'closed',
        attributes: {},
      }),
    ).toBe(0)
  })

  test('maps HA position into a signed physical offset', () => {
    expect(
      resolveCoverOpenOffset(
        {
          entityId: 'cover.salon',
          state: 'open',
          attributes: { current_position: 50 },
        },
        {
          axis: 'y',
          openOffsetMeters: 2,
          durationMs: 800,
        },
      ),
    ).toBe(1)
  })

  test('damps toward the target and supports instant motion', () => {
    const next = stepCoverOffset(0, 2, 0.1, 1000)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(2)
    expect(stepCoverOffset(0, 2, 0.1, 0)).toBe(2)
  })
})
