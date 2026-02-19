import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { useApp } from '../context/AppContext';
import { useCatalog, usePriceLists } from '../hooks';
import { defaultCatalog } from '../data/defaultCatalog';
import { defaultSettings } from '../data/defaultSettings';
import { defaultPriceLists, defaultPriceListCategories, defaultCatalogItems } from '../data/defaultPriceLists';
import type { ExportData } from '../repositories/StorageRepository';
import type { CatalogItem, Patient, Quote, QuoteItem, QuoteStatus } from '../types';
import { getAuthHeaders } from '../utils/auth';
import type { OdontogramState, OdontogramToothState } from '../modules/odontogram/types';
import { getBudapestDateKey, saveCurrent, saveDailySnapshot } from '../modules/odontogram/odontogramStorage';
import { Button, Card, CardContent, CardHeader, ConfirmModal } from '../components/common';
import {
  allPatientsToJson,
  singlePatientToJson,
  patientsToCsv,
  parsePatientExportJson,
  parsePatientsFromCsv,
} from '../utils/patientImportExport';

type DbTableStat = {
  tableName: string;
  rowCount: number;
  totalBytes: number;
  dataBytes: number;
  indexBytes: number;
};

type DbStatsResponse = {
  generatedAt: string;
  databaseName: string;
  databaseSizeBytes: number;
  tableCount: number;
  totalRows: number;
  totalTableBytes: number;
  tables: DbTableStat[];
};

const FDI_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
];

const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const includesAny = (source: string, needles: string[]) => needles.some((needle) => source.includes(needle));

const createDefaultToothState = (): OdontogramToothState => ({
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
});

const addUnique = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

const createOdontogramStateFromQuotes = (quotes: Quote[]): OdontogramState => {
  const teeth: Record<string, OdontogramToothState> = {};
  let hasVisibleChanges = false;

  FDI_TEETH.forEach((toothNo) => {
    teeth[toothNo] = createDefaultToothState();
  });

  const getTooth = (toothNum: string) => {
    if (!teeth[toothNum]) return createDefaultToothState();
    return teeth[toothNum];
  };

  quotes.forEach((quote) => {
    quote.items.forEach((item) => {
      if (!item.toothNum) return;
      const tooth = getTooth(item.toothNum);
      const title = item.quoteName.toLowerCase();

      if (includesAny(title, ['húzás', 'extract', 'extrakció', 'fogeltávolítás'])) {
        tooth.toothSelection = 'none';
        tooth.extractionPlan = true;
        tooth.extractionWound = true;
        hasVisibleChanges = true;
      } else if (includesAny(title, ['implant'])) {
        tooth.toothSelection = 'implant';
        hasVisibleChanges = true;
      } else {
        tooth.toothSelection = 'tooth-base';
      }

      if (includesAny(title, ['gyökér', 'gyökértömés', 'endo', 'trepanálás'])) {
        tooth.endo = 'endo-filling';
        hasVisibleChanges = true;
      }

      if (includesAny(title, ['szuvas', 'caries'])) {
        addUnique(tooth.caries, 'caries-mesial');
      }

      if (includesAny(title, ['tömés', 'filling', 'restaur', 'felépítése'])) {
        tooth.fillingMaterial = 'composite';
        addUnique(tooth.fillingSurfaces, 'occlusal');
        addUnique(tooth.fillingSurfaces, 'mesial');
        hasVisibleChanges = true;
      }

      if (includesAny(title, ['korona', 'crown', 'cirkónium', 'fém-kerámia', 'e.max'])) {
        tooth.crownMaterial = 'zircon';
        hasVisibleChanges = true;
      }

      if (includesAny(title, ['parod', 'fogkő', 'higién'])) {
        addUnique(tooth.mods, 'parodontal');
        hasVisibleChanges = true;
      }
    });
  });

  // Always keep a clearly visible baseline demo pattern, then let quote-derived data extend it.
  const tooth14 = getTooth('14');
  if (tooth14.fillingMaterial === 'none') {
    tooth14.fillingMaterial = 'composite';
    tooth14.fillingSurfaces = ['occlusal', 'mesial'];
    hasVisibleChanges = true;
  }

  const tooth16 = getTooth('16');
  if (tooth16.endo === 'none') {
    tooth16.endo = 'endo-filling';
    hasVisibleChanges = true;
  }

  const tooth26 = getTooth('26');
  if (tooth26.toothSelection === 'tooth-base') {
    tooth26.toothSelection = 'implant';
    hasVisibleChanges = true;
  }

  const tooth46 = getTooth('46');
  if (tooth46.toothSelection === 'tooth-base') {
    tooth46.toothSelection = 'none';
    tooth46.extractionPlan = true;
    tooth46.extractionWound = true;
    hasVisibleChanges = true;
  }

  if (!hasVisibleChanges) {
    const tooth24 = getTooth('24');
    tooth24.crownMaterial = 'zircon';
  }

  return {
    version: '1.0.0',
    globals: {
      wisdomVisible: true,
      showBase: true,
      occlusalVisible: true,
      showHealthyPulp: true,
      edentulous: false,
    },
    teeth,
  };
};

export function DataManagementPage() {
  const { t } = useSettings();
  const {
    patients: patientsFromContext,
    quotes,
    addPatient,
    updatePatient,
    addQuote,
    updateQuote,
    exportData,
    importData,
    refreshData,
    resetPriceLists,
  } = useApp();
  const { exportCatalog, importCatalog, exportCatalogCSV, importCatalogCSV } = useCatalog();
  const { pricelists: activePriceLists } = usePriceLists();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogJsonInputRef = useRef<HTMLInputElement>(null);
  const catalogCsvInputRef = useRef<HTMLInputElement>(null);

  const patientAllJsonInputRef = useRef<HTMLInputElement>(null);
  const patientAllCsvInputRef = useRef<HTMLInputElement>(null);
  const patientSingleJsonInputRef = useRef<HTMLInputElement>(null);
  const patientSingleCsvInputRef = useRef<HTMLInputElement>(null);

  const [importConfirm, setImportConfirm] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);
  const [pendingCatalogImport, setPendingCatalogImport] = useState<{ format: 'json' | 'csv'; data: string } | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');
  const [resetPriceListConfirm, setResetPriceListConfirm] = useState(false);
  const [pendingPatientImport, setPendingPatientImport] = useState<{ data: string; format: 'json' | 'csv'; mode: 'all' | 'single' } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const clearOdontogramStorageKeys = () => {
    // Legacy no-op after backend migration.
  };

  const createMockPatients = (): Patient[] => {
    const now = new Date().toISOString();
    const entries = [
      {
        title: 'Dr.',
        firstName: 'András', lastName: 'Daul', sex: 'male' as const,
        birthDate: '1988-01-01', birthPlace: 'Budapest',
        insuranceNum: '042-024-637',
        phone: '+36 30 123 4567', email: 'andras.teszt@gmail.com',
        country: 'Magyarország', zipCode: '9700', city: 'Szombathely',
        street: 'Teszt Elek utca 28.', patientType: 'NEAK páciens',
      },
      {
        title: '',
        firstName: 'Adél', lastName: 'Hencsi', sex: 'female' as const,
        birthDate: '1990-02-01', birthPlace: 'Debrecen',
        insuranceNum: '092-044-645',
        phone: '+36 20 234 5678', email: 'anett.teszt@example.com',
        country: 'Magyarország', zipCode: '9700', city: 'Szombathely',
        street: 'Teszt Anett 28.', patientType: 'NEAK páciens',
      },
      {
        title: '',
        firstName: 'Márk', lastName: 'Tóth', sex: 'male' as const,
        birthDate: '1994-03-01', birthPlace: 'Győr',
        insuranceNum: '345-678-908',
        phone: '+36 70 345 6789', email: 'toth.mark@example.com',
        country: 'Magyarország', zipCode: '4024', city: 'Debrecen',
        street: 'Piac u. 45.', patientType: 'Privát páciens',
      },
      {
        title: '',
        firstName: 'Sára', lastName: 'Illés', sex: 'female' as const,
        birthDate: '1975-04-01', birthPlace: 'Pécs',
        insuranceNum: '082-198-064',
        phone: '+36 30 456 7890', email: 'illes.teszt@yahoo.com',
        country: 'Magyarország', zipCode: '6720', city: 'Szeged',
        street: 'Tisza Lajos krt. 67.', patientType: 'NEAK páciens',
      },
      {
        title: '',
        firstName: 'Gizella', lastName: 'Fisly', sex: 'female' as const,
        birthDate: '1991-05-01', birthPlace: 'Miskolc',
        insuranceNum: '081-187-023',
        phone: '+36 20 567 8901', email: 'kiss.reka@example.com',
        country: 'Magyarország', zipCode: '7621', city: 'Pécs',
        street: 'Király u. 23.', patientType: 'NEAK páciens',
      },
      {
        title: '',
        firstName: 'Lilla', lastName: 'Balogh', sex: 'female' as const,
        birthDate: '1983-06-01', birthPlace: 'Szombathely',
        insuranceNum: '070-257-801',
        phone: '+36 70 678 9012', email: 'farkas.lilla@example.com',
        country: 'Magyarország', zipCode: '8200', city: 'Veszprém',
        street: 'Óváros tér 4.', patientType: 'NEAK páciens',
      },
    ];

    const usedIds = new Set<string>();
    const generate8DigitId = (): string => {
      let id: string;
      do {
        id = String(10000000 + Math.floor(Math.random() * 90000000));
      } while (usedIds.has(id));
      usedIds.add(id);
      return id;
    };

    return entries.map((entry) => ({
      patientId: generate8DigitId(),
      title: entry.title,
      firstName: entry.firstName,
      lastName: entry.lastName,
      sex: entry.sex,
      birthDate: entry.birthDate,
      birthPlace: entry.birthPlace,
      insuranceNum: entry.insuranceNum,
      phone: entry.phone,
      email: entry.email,
      country: entry.country,
      isForeignAddress: false,
      zipCode: entry.zipCode,
      city: entry.city,
      street: entry.street,
      patientType: entry.patientType,
      notes: '',
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    }));
  };

  const createMockQuotes = (patients: Patient[]): Quote[] => {
    const statuses: QuoteStatus[] = [
      'draft',
      'closed',
      'rejected',
      'started',
      'completed',
    ];
    const doctorId = defaultSettings.doctors[0]?.id || 'doc-1';
    const doctorName = defaultSettings.doctors[0]?.name || 'Dr. Demo';
    const pickStatus = () => statuses[Math.floor(Math.random() * statuses.length)];

    const activeCatalog = defaultCatalog.filter((item) => item.isActive);
    const toQuoteItems = (quoteCatalog: CatalogItem[]): QuoteItem[] =>
      quoteCatalog.map((catalogItem) => {
        const itemName = catalogItem.catalogName.toLowerCase();
        const quoteUnitPriceGross =
          catalogItem.catalogPrice > 0
            ? Math.round(catalogItem.catalogPrice * (0.9 + Math.random() * 0.2))
            : catalogItem.catalogPrice;
        const quoteQty = catalogItem.catalogUnit === 'db' || catalogItem.catalogUnit === 'fog'
          ? randomInt(1, 2)
          : 1;
        const lineDiscount = Math.random() < 0.25 ? randomInt(5, 15) : 0;
        const isToothSpecific =
          !catalogItem.isFullMouth &&
          !catalogItem.isArch &&
          (includesAny(itemName, [
            'fog', 'töm', 'korona', 'inlay', 'onlay', 'implant', 'gyökér', 'endo', 'húzás',
          ]) || Math.random() < 0.65);
        const selectedTooth = isToothSpecific
          ? FDI_TEETH[Math.floor(Math.random() * FDI_TEETH.length)]
          : undefined;

        return {
          lineId: nanoid(),
          catalogItemId: catalogItem.catalogItemId,
          quoteName: catalogItem.catalogName,
          quoteUnit: catalogItem.catalogUnit,
          quoteUnitPriceGross,
          quoteUnitPriceCurrency: catalogItem.catalogPriceCurrency,
          quoteQty,
          quoteLineDiscountType: 'percent',
          quoteLineDiscountValue: lineDiscount,
          toothType: selectedTooth ? 'tooth' : undefined,
          toothNum: selectedTooth,
          jaw: !selectedTooth && catalogItem.isArch ? (Math.random() < 0.5 ? 'upper' : 'lower') : undefined,
          treatedArea: catalogItem.isFullMouth
            ? 'Teljes száj'
            : catalogItem.isArch
              ? 'Állcsont'
              : selectedTooth
                ? `Fog ${selectedTooth}`
                : undefined,
          treatmentSession: randomInt(1, 3),
        };
      });

    return patients.flatMap((patient, patientIndex) => {
      const patientQuotes: Quote[] = [0, 1].map((quoteIndex) => {
        const created = new Date();
        created.setDate(created.getDate() - (patientIndex * 2 + quoteIndex));
        const createdAt = created.toISOString();
        const quoteItemCount = randomInt(5, Math.min(15, activeCatalog.length));
        const selectedCatalog = shuffle(activeCatalog).slice(0, quoteItemCount);
        const items = toQuoteItems(selectedCatalog);

        return {
          quoteId: nanoid(),
          quoteNumber: `MOCK-${String(patientIndex * 2 + quoteIndex + 1).padStart(4, '0')}`,
          patientId: patient.patientId,
          doctorId,
          quoteName: `Próba árajánlat ${quoteIndex + 1}`,
          createdAt,
          lastStatusChangeAt: createdAt,
          validUntil: new Date(created.getTime() + 1000 * 60 * 60 * 24 * 60).toISOString(),
          quoteStatus: pickStatus(),
          currency: 'HUF',
          items,
          globalDiscountType: 'percent',
          globalDiscountValue: Math.random() < 0.35 ? randomInt(5, 12) : 0,
          commentToPatient: '',
          internalNotes: '',
          expectedTreatments: randomInt(1, 4),
          events: [
            {
              id: nanoid(),
              timestamp: createdAt,
              type: 'created',
              doctorName,
            },
          ],
          isDeleted: false,
        };
      });

      return patientQuotes;
    });
  };

  const handleLoadMockData = () => {
    const patients = createMockPatients();
    const quotes = createMockQuotes(patients);
    const patientOdontogramStates = new Map<string, OdontogramState>();
    patients.forEach((patient) => {
      const patientQuotes = quotes.filter((quote) => quote.patientId === patient.patientId);
      patientOdontogramStates.set(patient.patientId, createOdontogramStateFromQuotes(patientQuotes));
    });
    const payload: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      patients,
      catalog: defaultCatalog,
      quotes,
      settings: defaultSettings,
      dentalStatusSnapshots: [],
    };

    clearOdontogramStorageKeys();
    const success = importData(JSON.stringify(payload));
    if (success) {
      const dateKey = getBudapestDateKey();
      patientOdontogramStates.forEach((state, patientId) => {
        saveCurrent(patientId, state);
        saveDailySnapshot(patientId, state, dateKey);
      });
      refreshData();
      setMessage({ type: 'success', text: t.dataManagement.databaseOnly.mockLoadSuccess });
    } else {
      setMessage({ type: 'error', text: t.dataManagement.importError });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const handleClearAllData = () => {
    const payload: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      patients: [],
      catalog: [],
      quotes: [],
      settings: defaultSettings,
      dentalStatusSnapshots: [],
    };

    clearOdontogramStorageKeys();
    const success = importData(JSON.stringify(payload));
    if (success) {
      refreshData();
      setMessage({ type: 'success', text: t.dataManagement.databaseOnly.clearAllSuccess });
    } else {
      setMessage({ type: 'error', text: t.dataManagement.importError });
    }
    setClearAllConfirm(false);
    setTimeout(() => setMessage(null), 5000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const data = exportData();
    downloadFile(data, `dental_quote_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');

    setMessage({ type: 'success', text: t.dataManagement.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCatalogExportJson = () => {
    const data = exportCatalog();
    // Filter by selected price list if one is chosen
    if (selectedPriceListId) {
      try {
        const items = JSON.parse(data) as CatalogItem[];
        const filtered = items.filter((item) =>
          (item as unknown as Record<string, unknown>).priceListId === selectedPriceListId
        );
        downloadFile(
          JSON.stringify(filtered, null, 2),
          `dental_catalog_${selectedPriceListId}_${new Date().toISOString().split('T')[0]}.json`,
          'application/json'
        );
      } catch {
        downloadFile(data, `dental_catalog_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      }
    } else {
      downloadFile(data, `dental_catalog_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    }
    setMessage({ type: 'success', text: t.dataManagement.catalogOnly.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCatalogExportCsv = () => {
    const data = exportCatalogCSV();
    downloadFile(
      data,
      `dental_catalog_${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8;'
    );
    setMessage({ type: 'success', text: t.dataManagement.catalogOnly.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleResetPriceLists = () => {
    resetPriceLists(defaultPriceLists, defaultPriceListCategories, defaultCatalogItems);
    refreshData();
    setResetPriceListConfirm(false);
    setMessage({ type: 'success', text: t.dataManagement.catalogOnly.resetSuccess });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPendingImportData(content);
      setImportConfirm(true);
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = '';
  };

  const handleCatalogFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    format: 'json' | 'csv'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPendingCatalogImport({ format, data: content });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImportConfirm = () => {
    if (!pendingImportData) return;

    const success = importData(pendingImportData);
    if (success) {
      refreshData();
      setMessage({ type: 'success', text: t.dataManagement.importSuccess });
    } else {
      setMessage({ type: 'error', text: t.dataManagement.importError });
    }

    setPendingImportData(null);
    setImportConfirm(false);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCatalogImportConfirm = () => {
    if (!pendingCatalogImport) return;

    const success =
      pendingCatalogImport.format === 'json'
        ? importCatalog(pendingCatalogImport.data)
        : importCatalogCSV(pendingCatalogImport.data);

    if (success) {
      setMessage({ type: 'success', text: t.dataManagement.catalogOnly.importSuccess });
    } else {
      setMessage({ type: 'error', text: t.dataManagement.catalogOnly.importError });
    }

    setPendingCatalogImport(null);
    setTimeout(() => setMessage(null), 5000);
  };

  // ---- Patient export handlers ----
  const handlePatientExportAllJson = () => {
    const data = allPatientsToJson(patientsFromContext, quotes);
    downloadFile(data, `patients_all_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    setMessage({ type: 'success', text: t.dataManagement.patientData.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePatientExportAllCsv = () => {
    const data = patientsToCsv(patientsFromContext);
    downloadFile(data, `patients_all_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    setMessage({ type: 'success', text: t.dataManagement.patientData.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePatientExportSingleJson = () => {
    if (!selectedPatientId) return;
    const patient = patientsFromContext.find((p) => p.patientId === selectedPatientId);
    if (!patient) return;
    const patientQuotes = quotes.filter((q) => q.patientId === selectedPatientId);
    const data = singlePatientToJson(patient, patientQuotes);
    const safeName = `${patient.lastName}_${patient.firstName}`.replace(/\s+/g, '_');
    downloadFile(data, `patient_${safeName}_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    setMessage({ type: 'success', text: t.dataManagement.patientData.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePatientExportSingleCsv = () => {
    if (!selectedPatientId) return;
    const patient = patientsFromContext.find((p) => p.patientId === selectedPatientId);
    if (!patient) return;
    const data = patientsToCsv([patient]);
    const safeName = `${patient.lastName}_${patient.firstName}`.replace(/\s+/g, '_');
    downloadFile(data, `patient_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    setMessage({ type: 'success', text: t.dataManagement.patientData.exportSuccess });
    setTimeout(() => setMessage(null), 3000);
  };

  // ---- Patient import handlers ----
  const handlePatientFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    format: 'json' | 'csv',
    mode: 'all' | 'single',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (mode === 'all') {
        setPendingPatientImport({ data: content, format, mode });
      } else {
        handlePatientImportSingle(content, format);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handlePatientImportSingle = (content: string, format: 'json' | 'csv') => {
    if (format === 'json') {
      const parsed = parsePatientExportJson(content);
      if (!parsed || parsed.patients.length === 0) {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      const patient = parsed.patients[0];
      const existing = patientsFromContext.find((p) => p.patientId === patient.patientId);
      if (existing) {
        updatePatient(patient);
      } else {
        addPatient(patient);
      }
      for (const quote of parsed.quotes) {
        const existingQuote = quotes.find((q) => q.quoteId === quote.quoteId);
        if (existingQuote) {
          updateQuote(quote);
        } else {
          addQuote(quote);
        }
      }
    } else {
      const parsed = parsePatientsFromCsv(content);
      if (!parsed || parsed.length === 0) {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      const row = parsed[0];
      if (row.patientId && row.lastName && row.firstName && row.sex && row.birthDate && row.createdAt && row.updatedAt && row.isArchived !== undefined) {
        const patient = row as Patient;
        const existing = patientsFromContext.find((p) => p.patientId === patient.patientId);
        if (existing) {
          updatePatient(patient);
        } else {
          addPatient(patient);
        }
      } else {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    }
    refreshData();
    setMessage({ type: 'success', text: t.dataManagement.patientData.importSuccess });
    setTimeout(() => setMessage(null), 5000);
  };

  const handlePatientImportConfirm = () => {
    if (!pendingPatientImport) return;
    const { data, format } = pendingPatientImport;

    if (format === 'json') {
      const parsed = parsePatientExportJson(data);
      if (!parsed) {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
        setPendingPatientImport(null);
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      const currentExport = JSON.parse(exportData()) as ExportData;
      const payload: ExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        patients: parsed.patients,
        catalog: currentExport.catalog,
        quotes: parsed.quotes,
        settings: currentExport.settings,
        dentalStatusSnapshots: currentExport.dentalStatusSnapshots,
      };
      const success = importData(JSON.stringify(payload));
      if (success) {
        refreshData();
        setMessage({ type: 'success', text: t.dataManagement.patientData.importSuccess });
      } else {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
      }
    } else {
      const parsed = parsePatientsFromCsv(data);
      if (!parsed) {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
        setPendingPatientImport(null);
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      const currentExport = JSON.parse(exportData()) as ExportData;
      const csvPatients = parsed.filter(
        (row): row is Patient =>
          !!row.patientId && !!row.lastName && !!row.firstName && !!row.sex && !!row.birthDate && !!row.createdAt && !!row.updatedAt && row.isArchived !== undefined,
      );
      const payload: ExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        patients: csvPatients,
        catalog: currentExport.catalog,
        quotes: currentExport.quotes,
        settings: currentExport.settings,
        dentalStatusSnapshots: currentExport.dentalStatusSnapshots,
      };
      const success = importData(JSON.stringify(payload));
      if (success) {
        refreshData();
        setMessage({ type: 'success', text: t.dataManagement.patientData.importSuccess });
      } else {
        setMessage({ type: 'error', text: t.dataManagement.patientData.importError });
      }
    }

    setPendingPatientImport(null);
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.dataManagement.title}</h1>
        <p className="text-gray-500 mt-1">{t.dataManagement.subtitle}</p>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg
            className="w-6 h-6 text-yellow-600 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-yellow-800">
            Az adatok PostgreSQL adatbazisban tarolodnak. Mentes/import tovabbra is ajanlott.
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Catalog-only Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.catalogOnly.title}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{t.dataManagement.catalogOnly.description}</p>
          <input
            ref={catalogJsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => handleCatalogFileSelect(event, 'json')}
          />
          <input
            ref={catalogCsvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleCatalogFileSelect(event, 'csv')}
          />
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.export}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.catalogOnly.exportDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    value={selectedPriceListId}
                    onChange={(e) => setSelectedPriceListId(e.target.value)}
                  >
                    <option value="">{t.common.all}</option>
                    {activePriceLists.map((pl) => (
                      <option key={pl.priceListId} value={pl.priceListId}>
                        {pl.priceListNameHu}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleCatalogExportJson}>
                    JSON
                  </Button>
                  <Button size="sm" onClick={handleCatalogExportCsv}>
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.import}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.catalogOnly.importDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => catalogJsonInputRef.current?.click()}
                  >
                    JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => catalogCsvInputRef.current?.click()}
                  >
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">{t.dataManagement.catalogOnly.resetTitle}</p>
                  <p className="text-xs text-red-600">{t.dataManagement.catalogOnly.resetDescription}</p>
                </div>
                <Button size="sm" variant="danger" onClick={() => setResetPriceListConfirm(true)}>
                  {t.dataManagement.catalogOnly.resetButton}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient Data Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.patientData.title}</h2>
        </CardHeader>
        <CardContent>
          <input
            ref={patientAllJsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => handlePatientFileSelect(e, 'json', 'all')}
          />
          <input
            ref={patientAllCsvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handlePatientFileSelect(e, 'csv', 'all')}
          />
          <input
            ref={patientSingleJsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => handlePatientFileSelect(e, 'json', 'single')}
          />
          <input
            ref={patientSingleCsvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handlePatientFileSelect(e, 'csv', 'single')}
          />
          <div className="space-y-4">
            {/* Row 1: Export all */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.patientData.exportAllTitle}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.patientData.exportAllDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handlePatientExportAllJson}>
                    JSON
                  </Button>
                  <Button size="sm" onClick={handlePatientExportAllCsv}>
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 2: Export single patient */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.patientData.exportSingleTitle}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.patientData.exportSingleDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                  >
                    <option value="">{t.dataManagement.patientData.selectPatient}</option>
                    {patientsFromContext.map((p) => (
                      <option key={p.patientId} value={p.patientId}>
                        {p.lastName} {p.firstName}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handlePatientExportSingleJson} disabled={!selectedPatientId}>
                    JSON
                  </Button>
                  <Button size="sm" onClick={handlePatientExportSingleCsv} disabled={!selectedPatientId}>
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 3: Import all */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.patientData.importAllTitle}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.patientData.importAllDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => patientAllJsonInputRef.current?.click()}>
                    JSON
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => patientAllCsvInputRef.current?.click()}>
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 4: Import single patient */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.patientData.importSingleTitle}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.patientData.importSingleDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => patientSingleJsonInputRef.current?.click()}>
                    JSON
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => patientSingleCsvInputRef.current?.click()}>
                    CSV
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Database Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.databaseOnly.title}</h2>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.export}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.databaseOnly.exportDescription}</p>
                </div>
                <Button size="sm" onClick={handleExport}>
                  JSON
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.dataManagement.import}</p>
                  <p className="text-xs text-gray-500">{t.dataManagement.databaseOnly.importDescription}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={handleImportClick}>
                  JSON
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {t.dataManagement.databaseOnly.mockLoadTitle}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.dataManagement.databaseOnly.mockLoadDescription}
                  </p>
                </div>
                <Button size="sm" onClick={handleLoadMockData}>
                  {t.dataManagement.databaseOnly.mockLoadButton}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {t.dataManagement.databaseOnly.clearAllTitle}
                  </p>
                  <p className="text-xs text-red-600">
                    {t.dataManagement.databaseOnly.clearAllDescription}
                  </p>
                </div>
                <Button size="sm" variant="danger" onClick={() => setClearAllConfirm(true)}>
                  {t.dataManagement.databaseOnly.clearAllButton}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Info */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.storageInfoTitle}</h2>
        </CardHeader>
        <CardContent>
          <StorageInfo />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.dataManagement.dbReportTitle}</h2>
        </CardHeader>
        <CardContent>
          <DatabaseReport />
        </CardContent>
      </Card>

      {/* Import Confirmation */}
      <ConfirmModal
        isOpen={pendingCatalogImport !== null}
        onClose={() => setPendingCatalogImport(null)}
        onConfirm={handleCatalogImportConfirm}
        title={t.common.confirm}
        message={t.dataManagement.catalogOnly.importWarning}
        confirmText={
          pendingCatalogImport?.format === 'csv'
            ? t.dataManagement.catalogOnly.importCsv
            : t.dataManagement.catalogOnly.importJson
        }
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Global Import Confirmation */}
      <ConfirmModal
        isOpen={importConfirm}
        onClose={() => {
          setImportConfirm(false);
          setPendingImportData(null);
        }}
        onConfirm={handleImportConfirm}
        title={t.common.confirm}
        message={t.dataManagement.importWarning}
        confirmText={t.dataManagement.importButton}
        cancelText={t.common.cancel}
        variant="danger"
      />

      <ConfirmModal
        isOpen={clearAllConfirm}
        onClose={() => setClearAllConfirm(false)}
        onConfirm={handleClearAllData}
        title={t.common.confirm}
        message={t.dataManagement.databaseOnly.clearAllConfirm}
        confirmText={t.dataManagement.databaseOnly.clearAllButton}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Patient Import Confirmation (all mode only) */}
      <ConfirmModal
        isOpen={pendingPatientImport !== null}
        onClose={() => setPendingPatientImport(null)}
        onConfirm={handlePatientImportConfirm}
        title={t.common.confirm}
        message={t.dataManagement.patientData.importAllWarning}
        confirmText={t.dataManagement.patientData.importAllTitle}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Reset Price Lists Confirmation */}
      <ConfirmModal
        isOpen={resetPriceListConfirm}
        onClose={() => setResetPriceListConfirm(false)}
        onConfirm={handleResetPriceLists}
        title={t.common.confirm}
        message={t.dataManagement.catalogOnly.resetConfirm}
        confirmText={t.dataManagement.catalogOnly.resetButton}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}

function StorageInfo() {
  const { t } = useSettings();
  const { patients, quotes, catalog } = useApp();

  const storageUsed = 'DB';

  return (
    <div className="space-y-3">
      <div className="flex justify-between py-2 border-b">
        <span className="text-gray-600">{t.dataManagement.storagePatientsCount}</span>
        <span className="font-medium">{patients.length}</span>
      </div>
      <div className="flex justify-between py-2 border-b">
        <span className="text-gray-600">{t.dataManagement.storageQuotesCount}</span>
        <span className="font-medium">{quotes.length}</span>
      </div>
      <div className="flex justify-between py-2 border-b">
        <span className="text-gray-600">{t.dataManagement.storageCatalogItems}</span>
        <span className="font-medium">{catalog.length}</span>
      </div>
      <div className="flex justify-between py-2">
        <span className="text-gray-600">{t.dataManagement.storageUsage}</span>
        <span className="font-medium">{storageUsed}</span>
      </div>
    </div>
  );
}

function DatabaseReport() {
  const { t } = useSettings();
  const [stats, setStats] = useState<DbStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/backend/db/stats', {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as DbStatsResponse;
        if (active) setStats(data);
      } catch {
        if (active) setError(t.dataManagement.dbReportError);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [t.dataManagement.dbReportError]);

  const formatNumber = (value: number) => new Intl.NumberFormat('hu-HU').format(value);

  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const value = unitIndex === 0 ? size.toFixed(0) : size.toFixed(2);
    return `${value} ${units[unitIndex]}`;
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{t.dataManagement.dbReportLoading}</p>;
  }

  if (error || !stats) {
    return <p className="text-sm text-red-600">{error || t.dataManagement.dbReportError}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">{t.dataManagement.dbReportDatabase}</p>
        <p className="mt-1 text-sm font-semibold text-gray-900 break-all leading-5">
          {stats.databaseName}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">{t.dataManagement.dbReportTables}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{formatNumber(stats.tableCount)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">{t.dataManagement.dbReportRows}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{formatNumber(stats.totalRows)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">{t.dataManagement.dbReportSize}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{formatBytes(stats.databaseSizeBytes)}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {t.dataManagement.dbReportLastUpdated}: {new Date(stats.generatedAt).toLocaleString('hu-HU')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">{t.dataManagement.dbReportTableName}</th>
              <th className="px-3 py-2 text-right">{t.dataManagement.dbReportTableRows}</th>
              <th className="px-3 py-2 text-right">{t.dataManagement.dbReportDataSize}</th>
              <th className="px-3 py-2 text-right">{t.dataManagement.dbReportIndexSize}</th>
              <th className="px-3 py-2 text-right">{t.dataManagement.dbReportTotalSize}</th>
            </tr>
          </thead>
          <tbody>
            {stats.tables
              .slice()
              .sort((a, b) => a.tableName.localeCompare(b.tableName))
              .map((table) => (
              <tr key={table.tableName} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">
                  <Link
                    to={`/data/browser?table=${encodeURIComponent(table.tableName)}`}
                    className="text-dental-600 hover:text-dental-800 hover:underline"
                  >
                    {table.tableName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{formatNumber(table.rowCount)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatBytes(table.dataBytes)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatBytes(table.indexBytes)}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatBytes(table.totalBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
