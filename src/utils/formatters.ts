export function formatCurrency(amount: number, currency: 'HUF' | 'EUR' = 'HUF'): string {
  if (currency === 'EUR') {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('hu-HU').format(num);
}

export function formatDate(dateString: string, format: 'short' | 'long' = 'short'): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (format === 'long') {
    const monthNames = [
      'január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
    ];
    return `${year}. ${monthNames[date.getMonth()]} ${day}.`;
  }
  // Format: YYYY.MM.DD
  return `${year}.${month}.${day}`;
}

export function formatDateForInput(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

export function formatInsuranceNum(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  // Format as 000-000-000
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}

export function formatPatientName(lastName: string, firstName: string): string {
  return `${lastName} ${firstName}`;
}

export function formatQuoteId(quoteId: string): string {
  // Take the last 8 characters for display
  return `AJ-${quoteId.slice(-8).toUpperCase()}`;
}

export function getCurrentDateString(): string {
  return new Date().toISOString();
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getDateOnly(dateString: string): string {
  return dateString.split('T')[0];
}
