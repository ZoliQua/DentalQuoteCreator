export type { JogviszonyCode, NeakCheckResult, NeakCheckLogEntry } from './types';
export { checkJogviszony, pingNeak } from './api';
export { saveCheck, getChecksByPatient, listChecks } from './storage';
