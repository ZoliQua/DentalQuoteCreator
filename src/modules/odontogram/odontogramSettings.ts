export type OdontogramLanguage = 'hu' | 'en' | 'de';
export type OdontogramNumberingSystem = 'FDI' | 'UNIVERSAL' | 'PALMER';

const DEFAULT_LANGUAGE: OdontogramLanguage = 'hu';
const DEFAULT_NUMBERING: OdontogramNumberingSystem = 'FDI';
let currentLanguage: OdontogramLanguage = DEFAULT_LANGUAGE;
let currentNumbering: OdontogramNumberingSystem = DEFAULT_NUMBERING;

const isLanguage = (value: string): value is OdontogramLanguage => {
  return value === 'hu' || value === 'en' || value === 'de';
};

const normalizeNumbering = (value: string): OdontogramNumberingSystem | null => {
  if (value === 'FDI' || value === 'UNIVERSAL' || value === 'PALMER') {
    return value;
  }
  if (value === 'Universal') return 'UNIVERSAL';
  if (value === 'Palmer') return 'PALMER';
  const normalized = value.toUpperCase();
  if (normalized === 'UNIVERSAL' || normalized === 'PALMER' || normalized === 'FDI') {
    return normalized;
  }
  return null;
};

export const getOdontogramLanguage = (): OdontogramLanguage => {
  return isLanguage(currentLanguage) ? currentLanguage : DEFAULT_LANGUAGE;
};

export const setOdontogramLanguage = (language: OdontogramLanguage): void => {
  currentLanguage = language;
};

export const getOdontogramNumbering = (): OdontogramNumberingSystem => {
  const normalized = normalizeNumbering(currentNumbering);
  return normalized ?? DEFAULT_NUMBERING;
};

export const setOdontogramNumbering = (numbering: OdontogramNumberingSystem): void => {
  currentNumbering = numbering;
};
