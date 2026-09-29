import { describe, expect, test } from 'bun:test'
import {
  clearLastProjectId,
  readLastProjectId,
  type ProjectPreferenceStorage,
  writeLastProjectId,
} from './project-preferences'

function memoryStorage(): ProjectPreferenceStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

describe('HA 3D project preferences', () => {
  test('stores and reads the last project id', () => {
    const storage = memoryStorage()
    expect(readLastProjectId(storage)).toBeNull()

    writeLastProjectId('home-main', storage)

    expect(readLastProjectId(storage)).toBe('home-main')
  })

  test('only clears a matching project when an id is supplied', () => {
    const storage = memoryStorage()
    writeLastProjectId('home-main', storage)

    clearLastProjectId('other-project', storage)
    expect(readLastProjectId(storage)).toBe('home-main')

    clearLastProjectId('home-main', storage)
    expect(readLastProjectId(storage)).toBeNull()
  })
})
