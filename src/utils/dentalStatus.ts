import { FDI_TOOTH_IDS } from '../data/dentalStatus';
import { FDITooth, ToothStatus, ToothState } from '../types';

export const DEFAULT_TOOTH_STATE: ToothState = 'healthy';

export function createHealthyTeethRecord(now: string): Record<FDITooth, ToothStatus> {
  return FDI_TOOTH_IDS.reduce((acc, toothId) => {
    acc[toothId] = {
      state: DEFAULT_TOOTH_STATE,
      updatedAt: now,
    };
    return acc;
  }, {} as Record<FDITooth, ToothStatus>);
}

export function cloneTeethWithUpdatedAt(
  teeth: Record<FDITooth, ToothStatus>,
  now: string
): Record<FDITooth, ToothStatus> {
  return FDI_TOOTH_IDS.reduce((acc, toothId) => {
    acc[toothId] = {
      ...teeth[toothId],
      updatedAt: now,
    };
    return acc;
  }, {} as Record<FDITooth, ToothStatus>);
}
