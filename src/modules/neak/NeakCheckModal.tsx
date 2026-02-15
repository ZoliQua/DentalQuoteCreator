import { useState, useEffect, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { Modal, Button } from '../../components/common';
import { useSettings } from '../../context/SettingsContext';
import { checkJogviszony } from './api';
import { saveCheck, getChecksByPatient } from './storage';
import type { NeakCheckResult, NeakCheckLogEntry, JogviszonyCode } from './types';

type NeakCheckModalProps = {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  taj: string; // formatted "000-000-000"
  patientName: string;
};

const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const jogviszonyBadge = (code: JogviszonyCode | undefined, t: ReturnType<typeof useSettings>['t']) => {
  if (!code) return null;
  const map: Record<JogviszonyCode, { label: string; color: string }> = {
    Z: { label: t.neak.resultZ, color: 'bg-green-100 text-green-800' },
    P: { label: t.neak.resultP, color: 'bg-yellow-100 text-yellow-800' },
    K: { label: t.neak.resultK, color: 'bg-blue-100 text-blue-800' },
    N: { label: t.neak.resultN, color: 'bg-red-100 text-red-800' },
    B: { label: t.neak.resultB, color: 'bg-red-100 text-red-800' },
    S: { label: t.neak.resultS, color: 'bg-yellow-100 text-yellow-800' },
  };
  const entry = map[code];
  if (!entry) return null;
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${entry.color}`}>
      {code} — {entry.label}
    </span>
  );
};

export function NeakCheckModal({ isOpen, onClose, patientId, taj, patientName }: NeakCheckModalProps) {
  const { t } = useSettings();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NeakCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<NeakCheckLogEntry[]>([]);

  const tajDigits = taj.replace(/-/g, '');

  const refreshHistory = useCallback(() => {
    setHistory(getChecksByPatient(patientId));
  }, [patientId]);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const date = todayYYYYMMDD();
      const checkResult = await checkJogviszony(tajDigits, date);
      setResult(checkResult);
      saveCheck({
        id: nanoid(),
        patientId,
        taj: tajDigits,
        checkedAt: new Date().toISOString(),
        date,
        result: checkResult,
      });
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.neak.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [tajDigits, patientId, refreshHistory, t.neak.errorGeneric]);

  const checkRunning = useRef(false);

  useEffect(() => {
    if (isOpen) {
      refreshHistory();
      if (!checkRunning.current) {
        checkRunning.current = true;
        runCheck().finally(() => { checkRunning.current = false; });
      }
    } else {
      setResult(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.neak.title} size="md">
      <div className="space-y-4">
        {/* Patient info */}
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{patientName}</span>
          <span className="ml-2">TAJ: {taj}</span>
        </div>

        {/* Current result */}
        <div className="rounded-lg border border-gray-200 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t.neak.checking}
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : result ? (
            <div className="space-y-2">
              <div>{jogviszonyBadge(result.jogviszony as JogviszonyCode, t)}</div>
              {result.tranKod && (
                <p className="text-sm text-gray-600">
                  {t.neak.transactionCode}: <span className="font-mono">{result.tranKod}</span>
                </p>
              )}
              {result.torlesNapja && (
                <p className="text-sm text-gray-600">
                  {t.neak.deletedOn}: {result.torlesNapja}
                </p>
              )}
              {result.kozlemeny && (
                <p className="text-sm text-gray-600">{result.kozlemeny}</p>
              )}
              {result.hibaSzoveg && result.hibaKod !== '0' && (
                <p className="text-sm text-red-600">{result.hibaSzoveg}</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Re-check button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={runCheck}
          disabled={loading}
        >
          {t.neak.recheck}
        </Button>

        {/* History */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.neak.history}</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">{t.neak.noHistory}</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded border border-gray-100 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {new Date(entry.checkedAt).toLocaleString()}
                    </span>
                    <span>
                      {entry.result.jogviszony
                        ? jogviszonyBadge(entry.result.jogviszony as JogviszonyCode, t)
                        : <span className="text-red-500">{entry.result.message || entry.result.hibaSzoveg || t.neak.errorGeneric}</span>
                      }
                    </span>
                  </div>
                  {entry.result.tranKod && (
                    <div className="text-xs text-gray-400 mt-1 font-mono">{entry.result.tranKod}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
