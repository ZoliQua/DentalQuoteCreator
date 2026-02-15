export type JogviszonyCode = 'Z' | 'P' | 'K' | 'N' | 'B' | 'S';

export type NeakCheckResult = {
  success: boolean;
  jogviszony?: JogviszonyCode;
  hibaKod: string;
  hibaSzoveg?: string;
  torlesNapja?: string;
  kozlemeny?: string;
  tranKod?: string;
  message?: string;
};

export type NeakCheckLogEntry = {
  id: string;
  patientId: string;
  taj: string;
  checkedAt: string; // ISO datetime
  date: string; // YYYYMMDD queried date
  result: NeakCheckResult;
};
