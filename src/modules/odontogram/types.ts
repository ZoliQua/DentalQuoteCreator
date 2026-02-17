export type OdontogramToothSelection =
  | 'none'
  | 'tooth-base'
  | 'milktooth'
  | 'implant'
  | 'variants';

export type OdontogramEndoStatus =
  | 'none'
  | 'endo-medical-filling'
  | 'endo-filling'
  | 'endo-filling-incomplete'
  | 'endo-glass-pin'
  | 'endo-metal-pin'
  | 'endo-resection';

export type OdontogramFillingMaterial =
  | 'none'
  | 'amalgam'
  | 'composite'
  | 'gic'
  | 'temporary';

export type OdontogramBridgeUnit =
  | 'none'
  | 'removable'
  | 'zircon'
  | 'metal'
  | 'temporary'
  | 'bar-prosthesis';

export type OdontogramMobility = 'none' | 'm1' | 'm2' | 'm3';

export type OdontogramCrownMaterial =
  | 'natural'
  | 'broken'
  | 'radix'
  | 'emax'
  | 'zircon'
  | 'metal'
  | 'temporary'
  | 'telescope';

export type OdontogramToothState = {
  toothSelection: OdontogramToothSelection;
  pulpInflam: boolean;
  endoResection: boolean;
  mods: string[];
  endo: OdontogramEndoStatus;
  caries: string[];
  fillingMaterial: OdontogramFillingMaterial;
  fillingSurfaces: string[];
  fissureSealing: boolean;
  contactMesial: boolean;
  contactDistal: boolean;
  bruxismWear: boolean;
  bruxismNeckWear: boolean;
  brokenMesial: boolean;
  brokenIncisal: boolean;
  brokenDistal: boolean;
  extractionWound: boolean;
  extractionPlan: boolean;
  parapulpalPin: boolean;
  bridgePillar: boolean;
  bridgeUnit: OdontogramBridgeUnit;
  mobility: OdontogramMobility;
  crownMaterial: OdontogramCrownMaterial;
};

export type OdontogramGlobals = {
  wisdomVisible: boolean;
  showBase: boolean;
  occlusalVisible: boolean;
  showHealthyPulp: boolean;
  edentulous: boolean;
};

export type OdontogramState = {
  version: string;
  globals: OdontogramGlobals;
  teeth: Record<string, OdontogramToothState>;
};

export type StoredOdontogramPayload = {
  version: number;
  updatedAt: string;
  state: OdontogramState;
};

export type OdontogramHistoryIndexEntry = {
  dateKey: string;
  updatedAt: string;
};

export type OdontogramTimelineEntry = {
  snapshotId: string;
  updatedAt: string;
};
