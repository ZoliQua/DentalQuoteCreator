declare module '@odontogram-shell' {
  import type { ComponentType } from 'react';
  import type {
    OdontogramLanguage,
    OdontogramNumberingSystem,
  } from './odontogramSettings';

  type OdontogramShellProps = {
    language?: OdontogramLanguage;
    onLanguageChange?: (lang: OdontogramLanguage) => void;
    numberingSystem?: OdontogramNumberingSystem;
    onNumberingChange?: (system: OdontogramNumberingSystem) => void;
  };

  const OdontogramShell: ComponentType<OdontogramShellProps>;
  export default OdontogramShell;

  export function clearSelection(): void;
  export function setOcclusalVisible(on: boolean): void;
  export function setWisdomVisible(on: boolean): void;
  export function setShowBase(on: boolean): void;
  export function setHealthyPulpVisible(on: boolean): void;
}
