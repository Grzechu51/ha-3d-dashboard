export function objectValue(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`[ha3d] ${label} must be an object`)
  }
  return raw as Record<string, unknown>
}

export function arrayValue(raw: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(raw)) throw new Error(`[ha3d] ${label} must be an array`)
  return raw
}

export function stringValue(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`[ha3d] ${label} must be a non-empty string`)
  }
  return raw
}

export function optionalString(raw: unknown, label: string): string | null {
  return raw === null || raw === undefined ? null : stringValue(raw, label)
}
