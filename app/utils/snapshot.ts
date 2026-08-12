// Shallow key-level diff of an object against a JSON snapshot taken earlier.
// Values compare by their JSON form so arrays and nested objects diff by
// content, and an unreadable snapshot reports no changes rather than every key.
export function getChangedKeysFromSnapshot(
  snapshot: string,
  current: Record<string, unknown>,
): string[] {
  if (!snapshot) { return [] }
  try {
    const parsed = JSON.parse(snapshot) as Record<string, unknown>
    const keys = new Set([...Object.keys(parsed), ...Object.keys(current)])
    return [...keys].filter(key =>
      JSON.stringify(current[key]) !== JSON.stringify(parsed[key]))
  }
  catch {
    return []
  }
}
