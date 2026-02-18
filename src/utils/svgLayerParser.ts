import type { QuoteItem } from '../types/quote';
import type { OdontogramState, OdontogramToothState } from '../modules/odontogram/types';

export const SURFACE_NAMES = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual'] as const;
export type SurfaceName = (typeof SURFACE_NAMES)[number];

export const MATERIAL_OPTIONS = ['composite', 'gic'] as const;
export type MaterialOption = (typeof MATERIAL_OPTIONS)[number];

export const SURFACE_ABBREVIATIONS: Record<SurfaceName, string> = {
  mesial: 'M',
  distal: 'D',
  occlusal: 'O',
  buccal: 'B',
  lingual: 'L',
};

// Upper arch: 11-17, 21-27. Lower arch: 31-37, 41-47. (wisdom teeth excluded)
const UPPER_TEETH = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27];
const LOWER_TEETH = [31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47];

export type ParsedLayerToken =
  | { type: 'static'; layerId: string }
  | { type: 'surfaces'; layerTemplate: string; maxSurfaces: number }
  | { type: 'material'; layerTemplate: string; maxMaterials: number }
  | { type: 'special'; kind: 'no-tooth' | 'full-denture' | 'bar-denture-12' | 'bar-denture-14' };

export function parseSvgLayer(svgLayerStr: string): ParsedLayerToken[] {
  if (!svgLayerStr || !svgLayerStr.trim()) return [];

  const parts = svgLayerStr.split(',').map((s) => s.trim()).filter(Boolean);
  const tokens: ParsedLayerToken[] = [];

  for (const part of parts) {
    if (part === '[no-tooth]') {
      tokens.push({ type: 'special', kind: 'no-tooth' });
      continue;
    }

    if (part === '[full-denture]') {
      tokens.push({ type: 'special', kind: 'full-denture' });
      continue;
    }

    if (part === '[bar-denture-12]') {
      tokens.push({ type: 'special', kind: 'bar-denture-12' });
      continue;
    }

    if (part === '[bar-denture-14]') {
      tokens.push({ type: 'special', kind: 'bar-denture-14' });
      continue;
    }

    const surfaceMatch = part.match(/\[surfaces(\d+)\]/);
    if (surfaceMatch) {
      const maxSurfaces = parseInt(surfaceMatch[1], 10);
      const template = part.replace(/\[surfaces\d+\]/, '{surface}');
      tokens.push({ type: 'surfaces', layerTemplate: template, maxSurfaces });
      continue;
    }

    const materialMatch = part.match(/\[material(\d+)\]/);
    if (materialMatch) {
      const maxMaterials = parseInt(materialMatch[1], 10);
      const template = part.replace(/\[material\d+\]/, '{material}');
      tokens.push({ type: 'material', layerTemplate: template, maxMaterials });
      continue;
    }

    tokens.push({ type: 'static', layerId: part });
  }

  return tokens;
}

export function requiresSurfaceSelection(tokens: ParsedLayerToken[]): { required: boolean; maxSurfaces: number } {
  for (const token of tokens) {
    if (token.type === 'surfaces') {
      return { required: true, maxSurfaces: token.maxSurfaces };
    }
  }
  return { required: false, maxSurfaces: 0 };
}

export function requiresMaterialSelection(tokens: ParsedLayerToken[]): { required: boolean; maxMaterials: number } {
  for (const token of tokens) {
    if (token.type === 'material') {
      return { required: true, maxMaterials: token.maxMaterials };
    }
  }
  return { required: false, maxMaterials: 0 };
}

export function isExtractionItem(tokens: ParsedLayerToken[]): boolean {
  return tokens.some((t) => t.type === 'special' && t.kind === 'no-tooth');
}

export function isFullDentureItem(tokens: ParsedLayerToken[]): boolean {
  return tokens.some((t) => t.type === 'special' && t.kind === 'full-denture');
}

export function isBarDentureItem(tokens: ParsedLayerToken[]): boolean {
  return tokens.some((t) => t.type === 'special' && (t.kind === 'bar-denture-12' || t.kind === 'bar-denture-14'));
}

/** Determine quadrant from a tooth number: Q1=11-18, Q2=21-28, Q3=31-38, Q4=41-48 */
export function getQuadrantFromTooth(toothNum: number): '1' | '2' | '3' | '4' {
  if (toothNum >= 11 && toothNum <= 18) return '1';
  if (toothNum >= 21 && toothNum <= 28) return '2';
  if (toothNum >= 31 && toothNum <= 38) return '3';
  return '4';
}

export function resolveLayerIds(
  tokens: ParsedLayerToken[],
  selectedSurfaces?: string[],
  selectedMaterial?: string
): string[] {
  const ids: string[] = [];

  for (const token of tokens) {
    if (token.type === 'static') {
      ids.push(token.layerId);
    } else if (token.type === 'surfaces' && selectedSurfaces) {
      for (const surface of selectedSurfaces) {
        ids.push(token.layerTemplate.replace('{surface}', surface));
      }
    } else if (token.type === 'material' && selectedMaterial) {
      ids.push(token.layerTemplate.replace('{material}', selectedMaterial));
    } else if (token.type === 'special') {
      // Produce markers so computeOdontogramStateFromItems can detect them
      ids.push(`__${token.kind}`);
    }
  }

  return ids;
}

function getDefaultToothState(): OdontogramToothState {
  return {
    toothSelection: 'tooth-base',
    pulpInflam: false,
    endoResection: false,
    mods: [],
    endo: 'none',
    caries: [],
    fillingMaterial: 'none',
    fillingSurfaces: [],
    fissureSealing: false,
    contactMesial: false,
    contactDistal: false,
    bruxismWear: false,
    bruxismNeckWear: false,
    brokenMesial: false,
    brokenIncisal: false,
    brokenDistal: false,
    extractionWound: false,
    extractionPlan: false,
    bridgePillar: false,
    bridgeUnit: 'none',
    mobility: 'none',
    crownMaterial: 'natural',
    parapulpalPin: false,
  };
}

function ensureTooth(state: OdontogramState, toothNum: string): OdontogramToothState {
  if (!state.teeth[toothNum]) {
    state.teeth[toothNum] = getDefaultToothState();
  }
  return state.teeth[toothNum];
}

const BAR_DENTURE_MISSING: Record<string, { upper: number[]; lower: number[] }> = {
  '12': {
    upper: [16, 15, 13, 11, 21, 23, 25, 26],
    lower: [46, 45, 43, 41, 31, 33, 35, 36],
  },
  '14': {
    upper: [17, 16, 15, 13, 11, 21, 23, 25, 26, 27],
    lower: [47, 46, 45, 43, 41, 31, 33, 35, 36, 37],
  },
};

export function computeOdontogramStateFromItems(
  items: QuoteItem[],
  baseState?: OdontogramState
): OdontogramState {
  const state: OdontogramState = baseState
    ? JSON.parse(JSON.stringify(baseState))
    : {
        version: '1.0',
        globals: {
          wisdomVisible: true,
          showBase: false,
          occlusalVisible: false,
          showHealthyPulp: false,
          edentulous: false,
        },
        teeth: {},
      };

  for (const item of items) {
    const layers = item.resolvedLayers || [];

    // --- [full-denture]: arch-level, no toothNum ---
    if (layers.includes('__full-denture') && item.treatedArea) {
      const archTeeth = item.treatedArea === 'upper' ? UPPER_TEETH : LOWER_TEETH;
      for (const t of archTeeth) {
        const key = String(t);
        state.teeth[key] = {
          ...getDefaultToothState(),
          toothSelection: 'none',
          bridgeUnit: 'removable',
        };
      }
      continue;
    }

    // --- [bar-denture-12] / [bar-denture-14]: arch-level missing teeth with bar-prosthesis ---
    const barDenture12 = layers.includes('__bar-denture-12');
    const barDenture14 = layers.includes('__bar-denture-14');
    if ((barDenture12 || barDenture14) && item.treatedArea) {
      const variant = barDenture12 ? '12' : '14';
      const missingMap = BAR_DENTURE_MISSING[variant];
      const missingTeeth = item.treatedArea === 'upper' ? missingMap.upper : missingMap.lower;
      for (const t of missingTeeth) {
        const key = String(t);
        state.teeth[key] = {
          ...getDefaultToothState(),
          toothSelection: 'none',
          bridgeUnit: 'bar-prosthesis',
        };
      }
      continue;
    }

    // Items below require a toothNum
    if (!item.toothNum) continue;

    // Handle comma-separated tooth numbers (e.g. maxTeethPerArch items)
    const toothNums = item.toothNum.includes(',') ? item.toothNum.split(',').map(t => t.trim()) : [item.toothNum];

    for (const tn of toothNums) {
      const toothState = ensureTooth(state, tn);

      // --- [no-tooth]: remove the tooth entirely (tooth gap) ---
      if (layers.includes('__no-tooth')) {
        toothState.toothSelection = 'none';
        // Clear all visual properties for a clean gap
        toothState.crownMaterial = 'natural';
        toothState.fillingMaterial = 'none';
        toothState.fillingSurfaces = [];
        toothState.endo = 'none';
        toothState.endoResection = false;
        toothState.bridgeUnit = 'none';
        toothState.extractionPlan = false;
        toothState.extractionWound = false;
        toothState.fissureSealing = false;
        toothState.mods = [];
        // Don't continue — process remaining layers (e.g. prosthesis-crown)
      }

      for (const layerId of layers) {
        // Skip special markers
        if (layerId.startsWith('__')) continue;

        // filling-{material}-{surface}
        const fillingMatch = layerId.match(/^filling-(composite|gic|amalgam|temporary)-(\w+)$/);
        if (fillingMatch) {
          toothState.fillingMaterial = fillingMatch[1] as OdontogramToothState['fillingMaterial'];
          if (!toothState.fillingSurfaces.includes(fillingMatch[2])) {
            toothState.fillingSurfaces.push(fillingMatch[2]);
          }
          continue;
        }

        // implant-base
        if (layerId === 'implant-base') {
          toothState.toothSelection = 'implant';
          continue;
        }

        // implant components → set as implant + add to mods
        if (layerId === 'implant-connector' || layerId === 'implant-locator-screw') {
          toothState.toothSelection = 'implant';
          if (!toothState.mods.includes(layerId)) {
            toothState.mods.push(layerId);
          }
          continue;
        }

        // telescope-crown-inside / telescope-crown-outside → crownMaterial: 'telescope'
        if (layerId === 'telescope-crown-inside' || layerId === 'telescope-crown-outside') {
          toothState.crownMaterial = 'telescope';
          continue;
        }

        // crown materials: metal-crown, zircon-crown, emax-crown, temporary-crown, telescope-crown
        const crownMatch = layerId.match(/^(metal|zircon|emax|temporary|telescope)-crown$/);
        if (crownMatch) {
          const material = crownMatch[1] as OdontogramToothState['crownMaterial'];
          toothState.crownMaterial = material;
          // Also override bridgeUnit if the tooth currently has a fixed prosthetic bridge unit
          if (toothState.bridgeUnit === 'metal' || toothState.bridgeUnit === 'zircon' || toothState.bridgeUnit === 'temporary') {
            const mappedBridge = material === 'emax' ? 'zircon' : material;
            if (mappedBridge === 'metal' || mappedBridge === 'zircon' || mappedBridge === 'temporary') {
              toothState.bridgeUnit = mappedBridge as OdontogramToothState['bridgeUnit'];
            }
          }
          continue;
        }

        // endo statuses
        if (
          layerId === 'endo-filling' ||
          layerId === 'endo-medical-filling' ||
          layerId === 'endo-glass-pin' ||
          layerId === 'endo-metal-pin'
        ) {
          toothState.endo = layerId as OdontogramToothState['endo'];
          continue;
        }

        // endo-resection
        if (layerId === 'endo-resection') {
          toothState.endoResection = true;
          continue;
        }

        // fissure sealing
        if (layerId === 'fissure-sealing-occlusal') {
          toothState.fissureSealing = true;
          continue;
        }

        // prosthesis-crown → removable prosthesis (toothSelection must be 'none' + bridgeUnit 'removable')
        if (layerId === 'prosthesis-crown') {
          toothState.toothSelection = 'none';
          toothState.bridgeUnit = 'removable';
          continue;
        }

        // Generic: add unknown layers to mods so the engine can pick them up
        if (!toothState.mods.includes(layerId)) {
          toothState.mods.push(layerId);
        }
      }
    }
  }

  return state;
}
