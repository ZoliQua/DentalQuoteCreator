declare module '@odontogram-shell' {
  import type { ComponentType } from 'react';
  import type {
    OdontogramLanguage,
    OdontogramNumberingSystem,
  } from './odontogramSettings';

  /**
   * Custom theme configuration. Overrides the default color palette via
   * CSS custom properties (`--odon-*`).
   */
  type OdontogramThemeConfig = {
    colors?: {
      background?: string;
      panel?: string;
      card?: string;
      text?: string;
      muted?: string;
      line?: string;
      accent?: string;
      accent2?: string;
    };
  };

  type OdontogramShellProps = {
    language?: OdontogramLanguage;
    onLanguageChange?: (lang: OdontogramLanguage) => void;
    numberingSystem?: OdontogramNumberingSystem;
    onNumberingChange?: (system: OdontogramNumberingSystem) => void;
    darkMode?: boolean;
    onDarkModeChange?: (dark: boolean) => void;
    /** Custom theme configuration for color overrides. */
    themeConfig?: OdontogramThemeConfig;
  };

  const OdontogramShell: ComponentType<OdontogramShellProps>;
  export default OdontogramShell;

  export function clearSelection(): void;
  export function setOcclusalVisible(on: boolean): void;
  export function setWisdomVisible(on: boolean): void;
  export function setShowBase(on: boolean): void;
  export function setHealthyPulpVisible(on: boolean): void;
}
