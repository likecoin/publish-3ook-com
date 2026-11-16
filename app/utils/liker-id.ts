export const LIKER_ID_MIN_LENGTH = 5
export const LIKER_ID_MAX_LENGTH = 20

// Canonical stored form of a user-supplied username: no `@`, no padding, lowercase.
export function getCanonicalLikerId(input: string): string {
  const trimmed = input.trim()
  return (trimmed.startsWith('@') ? trimmed.slice(1) : trimmed).toLowerCase()
}

// Mirrors the API's checkUserNameValid, so a bad username is rejected before a round-trip.
export function checkLikerIdValid(likerId: string): boolean {
  return /^[a-z0-9-_]+$/.test(likerId)
    && likerId.length >= LIKER_ID_MIN_LENGTH
    && likerId.length <= LIKER_ID_MAX_LENGTH
}
