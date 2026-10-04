import { expect, test } from 'bun:test'
import {
  acceptsKeyboardPan,
  clearKeyboardPanKeys,
  hasKeyboardPanInput,
  isKeyboardPanKey,
  type KeyboardPanState,
  keyboardPanDirection,
  keyboardPanSpeed,
  setKeyboardPanKey,
} from './keyboard-pan'

const idle = (): KeyboardPanState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
})
const key = (init: Partial<KeyboardEvent>) => ({ target: null, ...init }) as KeyboardEvent

test('physical WASD keys drive a screen-space direction; letters on other layouts do not', () => {
  const state = idle()
  expect(isKeyboardPanKey('KeyZ')).toBe(false)
  expect(setKeyboardPanKey(state, 'KeyW', true)).toBe(true)
  expect(setKeyboardPanKey(state, 'KeyW', true)).toBe(false)
  setKeyboardPanKey(state, 'KeyD', true)
  expect(keyboardPanDirection(state)).toEqual({ horizontal: 1, vertical: 1 })
  setKeyboardPanKey(state, 'KeyA', true)
  expect(keyboardPanDirection(state)).toEqual({ horizontal: 0, vertical: 1 })
  clearKeyboardPanKeys(state)
  expect(hasKeyboardPanInput(state)).toBe(false)
})

test('modifier chords stay shortcuts, and typing in a field never pans', () => {
  expect(acceptsKeyboardPan(key({}))).toBe(true)
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey'] as const)
    expect(acceptsKeyboardPan(key({ [modifier]: true }))).toBe(false)
  const input = { tagName: 'INPUT', getAttribute: () => null } as unknown as EventTarget
  expect(acceptsKeyboardPan(key({ target: input }))).toBe(false)

  // Home Assistant retargets a shadow-root keyboard event to <ha3d-panel>.
  // The real input remains visible through composedPath().
  const host = { tagName: 'HA3D-PANEL', getAttribute: () => null } as unknown as EventTarget
  const shadowEvent = {
    target: host,
    composedPath: () => [input, host],
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  } as unknown as KeyboardEvent
  expect(acceptsKeyboardPan(shadowEvent)).toBe(false)
})

test('speed scales with the visible width within fixed bounds', () => {
  expect(keyboardPanSpeed(0)).toBe(2)
  expect(keyboardPanSpeed(20)).toBeCloseTo(13)
  expect(keyboardPanSpeed(1000)).toBe(55)
})
