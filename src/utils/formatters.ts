import type { DateFormat } from '../types';

const SETTINGS_STORAGE_KEY = 'dental_quote_settings';
const DEFAULT_DATE_FORMAT: DateFormat = 'YYYY-MM-DD HH:MM:SS';

const pad = (value: number) => String(value).padStart(2, '0');

const DATE_ONLY_PATTERNS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYY.MM.DD',
  'DD.MM.YYYY',
  'DD/MM/YYYY',
  'MM.DD.YYYY',
  'MM/DD/YYYY',
] as const;

type DateOnlyPattern = (typeof DATE_ONLY_PATTERNS)[number];

const isDateOnlyPattern = (value: string): value is DateOnlyPattern => {
  return DATE_ONLY_PATTERNS.includes(value as DateOnlyPattern);
};

const normalizeDateFormat = (value?: string): DateFormat => {
  if (!value) return DEFAULT_DATE_FORMAT;
  if (value.endsWith(' HH:MM:SS')) {
    return value as DateFormat;
  }
  if (isDateOnlyPattern(value)) {
    return `${value} HH:MM:SS` as DateFormat;
  }
  return DEFAULT_DATE_FORMAT;
};

const getDatePatternFromDateTime = (pattern: DateFormat): DateOnlyPattern => {
  const [datePattern] = pattern.split(' ');
  if (isDateOnlyPattern(datePattern)) return datePattern;
  return 'YYYY-MM-DD';
};

export function formatDateWithPattern(date: Date, pattern: DateOnlyPattern): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  switch (pattern) {
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'YYYY.MM.DD':
      return `${year}.${month}.${day}`;
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM.DD.YYYY':
      return `${month}.${day}.${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
    }
}

export function getSelectedDateFormat(): DateFormat {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_DATE_FORMAT;
    const parsed = JSON.parse(raw) as { dateFormat?: string };
    return normalizeDateFormat(parsed?.dateFormat);
  } catch {
    return DEFAULT_DATE_FORMAT;
  }
}

export function formatDateTimeWithPattern(date: Date, pattern: DateFormat): string {
  const datePart = formatDateWithPattern(date, getDatePatternFromDateTime(pattern));
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart} ${timePart}`;
}

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

  if (format === 'long') {
    const year = date.getFullYear();
    const day = pad(date.getDate());
    const monthNames = [
      'január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
    ];
    return `${year}. ${monthNames[date.getMonth()]} ${day}.`;
  }

  return formatDateWithPattern(date, getDatePatternFromDateTime(getSelectedDateFormat()));
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return formatDateTimeWithPattern(date, getSelectedDateFormat());
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

export function formatPatientName(lastName: string, firstName: string, title?: string): string {
  const parts = [title, lastName, firstName].filter(Boolean);
  return parts.join(' ');
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

export function getDatePlaceholder(): string {
  return getDatePatternFromDateTime(getSelectedDateFormat());
}

export function formatBirthDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return isoDate;
  return formatDateWithPattern(date, getDatePatternFromDateTime(getSelectedDateFormat()));
}

export function parseBirthDateFromDisplay(displayValue: string): string {
  if (!displayValue) return '';
  const pattern = getDatePatternFromDateTime(getSelectedDateFormat());

  const sep = pattern.includes('/') ? '/' : pattern.includes('.') ? '.' : '-';
  const parts = displayValue.split(sep).map((s) => s.trim());
  if (parts.length !== 3) return '';

  let year: number, month: number, day: number;

  if (pattern.startsWith('YYYY')) {
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else if (pattern.startsWith('DD')) {
    day = parseInt(parts[0]);
    month = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else {
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
    year = parseInt(parts[2]);
  }

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return '';
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return '';

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
