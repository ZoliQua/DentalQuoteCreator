/**
 * Hungarian phone number normalization to E.164 format.
 *
 * Supported inputs:
 *   +36 20 123 4567  → +36201234567
 *   06201234567      → +36201234567
 *   201234567        → +36201234567 (when isHungarian=true)
 */

const HUNGARIAN_MOBILE_PREFIXES = ['20', '30', '31', '50', '70']
const HUNGARIAN_LANDLINE_PREFIXES = ['1'] // Budapest

export function normalizePhoneNumber(phone: string, isHungarian = true): string {
  // Strip all non-digit characters except leading +
  const hasPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')

  // Already in international format with +36
  if (hasPlus && digits.startsWith('36') && digits.length >= 11) {
    return `+${digits}`
  }

  // International format without + (e.g., 36201234567)
  if (digits.startsWith('36') && digits.length >= 11) {
    return `+${digits}`
  }

  // Hungarian domestic format: 06XXXXXXXXX
  if (digits.startsWith('06') && digits.length >= 10) {
    return `+36${digits.slice(2)}`
  }

  // Short format without country/trunk code (e.g., 201234567)
  if (isHungarian && !digits.startsWith('06') && !digits.startsWith('36')) {
    const prefix2 = digits.slice(0, 2)
    const prefix1 = digits.slice(0, 1)
    if (HUNGARIAN_MOBILE_PREFIXES.includes(prefix2) || HUNGARIAN_LANDLINE_PREFIXES.includes(prefix1)) {
      return `+36${digits}`
    }
  }

  // If it already starts with +, pass through (international non-HU number)
  if (hasPlus) {
    return `+${digits}`
  }

  throw new Error(`Cannot normalize phone number: ${phone}`)
}

export function isValidHungarianMobile(e164: string): boolean {
  // E.164 Hungarian mobile: +36(20|30|31|50|70)XXXXXXX (12 digits total with +)
  const match = e164.match(/^\+36(20|30|31|50|70)\d{7}$/)
  return match !== null
}

export function isValidE164(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone)
}
