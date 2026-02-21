export function validateEmail(email: string): boolean {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  // Hungarian phone format: +36 XX XXX XXXX or similar
  const phoneRegex = /^[\d\s+()-]{6,20}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate Hungarian TAJ (social security) number with CDV check digit
 * Format: SSS-SSS-SSK where S is sequential ID and K is check digit
 * Check digit calculation:
 * - Multiply odd positions (1,3,5,7) by 3
 * - Multiply even positions (2,4,6,8) by 7
 * - Sum all products
 * - Check digit = sum mod 10
 */
export function validateInsuranceNum(insuranceNum: string): boolean {
  if (!insuranceNum) return true; // Optional field

  // Check format: 000-000-000
  const tajRegex = /^\d{3}-\d{3}-\d{3}$/;
  if (!tajRegex.test(insuranceNum)) return false;

  // Extract digits only
  const digits = insuranceNum.replace(/-/g, '');
  if (digits.length !== 9) return false;

  // Calculate CDV check digit
  const weights = [3, 7, 3, 7, 3, 7, 3, 7]; // alternating weights for first 8 digits
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  const expectedCheckDigit = sum % 10;
  const actualCheckDigit = parseInt(digits[8], 10);

  return expectedCheckDigit === actualCheckDigit;
}

/**
 * Get TAJ validation state for UI feedback
 * Returns: 'empty' | 'incomplete' | 'invalid' | 'valid'
 */
export type TajValidationState = 'empty' | 'incomplete' | 'invalid' | 'valid';

export function getTajValidationState(insuranceNum: string, neakDocumentType?: number): TajValidationState {
  if (!insuranceNum || insuranceNum.trim() === '') return 'empty';

  // When NEAK document type is not TAJ (1), accept any non-empty value
  if (neakDocumentType !== undefined && neakDocumentType !== 1) return 'valid';

  // Remove dashes for length check
  const digitsOnly = insuranceNum.replace(/-/g, '');

  // Check if still typing (less than 9 digits)
  if (digitsOnly.length < 9) return 'incomplete';

  // Full length, check if valid
  return validateInsuranceNum(insuranceNum) ? 'valid' : 'invalid';
}

export function validateDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function validateRequired(value: string | undefined | null): boolean {
  return value !== undefined && value !== null && value.trim() !== '';
}

export function validateMinValue(value: number, min: number): boolean {
  return value >= min;
}

export function validateMaxValue(value: number, max: number): boolean {
  return value <= max;
}

export function validateCatalogCode(code: string): boolean {
  // Code should be alphanumeric, 2-10 characters
  const codeRegex = /^[A-Z0-9]{2,10}$/i;
  return codeRegex.test(code);
}
