import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { useApp } from '../context/AppContext';
import { useCatalog, usePriceLists, usePriceListCategories } from '../hooks';
import { useInvoices } from '../hooks/useInvoices';
import { defaultSettings } from '../data/defaultSettings';
import { defaultPriceLists, defaultPriceListCategories, defaultCatalogItems } from '../data/defaultPriceLists';
import type { ExportData } from '../repositories/StorageRepository';
import type { CatalogItem, Patient, Quote, QuoteItem, QuoteStatus } from '../types';
import { getAuthHeaders } from '../utils/auth';
import type { OdontogramState, OdontogramToothState } from '../modules/odontogram/types';
import { getBudapestDateKey, saveCurrent, saveDailySnapshot } from '../modules/odontogram/odontogramStorage';
import { Button, Card, CardContent, CardHeader, ConfirmModal, PageTabBar } from '../components/common';
import type { PageTab } from '../components/common/PageTabBar';
import { UsageSection } from './UsageSection';
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

type DataSection = 'pricelist' | 'patients' | 'storage' | 'database' | 'usage';

export function DataManagementPage({ section }: { section?: DataSection }) {
  const { t, refreshSettings } = useSettings();
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
    pricelistCategories,
    catalog,
    neakCatalog,
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
  const [mockLoadConfirm, setMockLoadConfirm] = useState(false);
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
        mothersName: 'Kiss Mária', neakDocumentType: 1,
        patientVATName: '', patientVATNumber: '', patientVATAddress: '',
        patientDiscount: 10 as number | null,
      },
      {
        title: '',
        firstName: 'Adél', lastName: 'Hencsi', sex: 'female' as const,
        birthDate: '1990-02-01', birthPlace: 'Debrecen',
        insuranceNum: '092-044-645',
        phone: '+36 20 234 5678', email: 'anett.teszt@example.com',
        country: 'Magyarország', zipCode: '9700', city: 'Szombathely',
        street: 'Teszt Anett 28.', patientType: 'NEAK páciens',
        mothersName: 'Nagy Erzsébet', neakDocumentType: 1,
        patientVATName: 'Tóth és Társa Kft.', patientVATNumber: '12345678-1-18', patientVATAddress: '1052 Budapest Váci utca 10.',
        patientDiscount: null as number | null,
      },
      {
        title: '',
        firstName: 'Márk', lastName: 'Tóth', sex: 'male' as const,
        birthDate: '1994-03-01', birthPlace: 'Győr',
        insuranceNum: '345-678-908',
        phone: '+36 70 345 6789', email: 'toth.mark@example.com',
        country: 'Magyarország', zipCode: '4024', city: 'Debrecen',
        street: 'Piac u. 45.', patientType: 'Privát páciens',
        mothersName: 'Tóth Katalin', neakDocumentType: 1,
        patientVATName: '', patientVATNumber: '', patientVATAddress: '',
        patientDiscount: 5 as number | null,
      },
      {
        title: '',
        firstName: 'Sára', lastName: 'Illés', sex: 'female' as const,
        birthDate: '1975-04-01', birthPlace: 'Pécs',
        insuranceNum: '082-198-064',
        phone: '+36 30 456 7890', email: 'illes.teszt@yahoo.com',
        country: 'Magyarország', zipCode: '6720', city: 'Szeged',
        street: 'Tisza Lajos krt. 67.', patientType: 'NEAK páciens',
        mothersName: 'Szabó Ilona', neakDocumentType: 1,
        patientVATName: '', patientVATNumber: '', patientVATAddress: '',
        patientDiscount: null as number | null,
      },
      {
        title: '',
        firstName: 'Gizella', lastName: 'Fisly', sex: 'female' as const,
        birthDate: '1991-05-01', birthPlace: 'Miskolc',
        insuranceNum: '081-187-023',
        phone: '+36 20 567 8901', email: 'kiss.reka@example.com',
        country: 'Magyarország', zipCode: '7621', city: 'Pécs',
        street: 'Király u. 23.', patientType: 'NEAK páciens',
        mothersName: 'Horváth Judit', neakDocumentType: 1,
        patientVATName: '', patientVATNumber: '', patientVATAddress: '',
        patientDiscount: null as number | null,
      },
      {
        title: '',
        firstName: 'Lilla', lastName: 'Balogh', sex: 'female' as const,
        birthDate: '1983-06-01', birthPlace: 'Szombathely',
        insuranceNum: '070-257-801',
        phone: '+36 70 678 9012', email: 'farkas.lilla@example.com',
        country: 'Magyarország', zipCode: '8200', city: 'Veszprém',
        street: 'Óváros tér 4.', patientType: 'NEAK páciens',
        mothersName: 'Varga Anna', neakDocumentType: 1,
        patientVATName: '', patientVATNumber: '', patientVATAddress: '',
        patientDiscount: null as number | null,
      },
    ];

    let nextIdNum = 10000000;
    const generatePatientId = (): string => {
      nextIdNum += 1;
      return 'P' + String(nextIdNum);
    };

    return entries.map((entry) => ({
      patientId: generatePatientId(),
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
      mothersName: entry.mothersName,
      neakDocumentType: entry.neakDocumentType,
      patientVATName: entry.patientVATName,
      patientVATNumber: entry.patientVATNumber,
      patientVATAddress: entry.patientVATAddress,
      patientDiscount: entry.patientDiscount,
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
    const doctorId = defaultSettings.doctors[0]?.id || 'DOC0001';
    const doctorName = defaultSettings.doctors[0]?.name || 'Dr. Demo';
    const pickStatus = () => statuses[Math.floor(Math.random() * statuses.length)];

    const activeCatalog = defaultCatalogItems.filter((item) => item.isActive);
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
          quoteId: `${patient.patientId}q${String(quoteIndex + 1).padStart(3, '0')}`,
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
      catalog: defaultCatalogItems,
      quotes,
      settings: defaultSettings,
      dentalStatusSnapshots: [],
      pricelists: defaultPriceLists,
      pricelistCategories: defaultPriceListCategories,
      doctors: defaultSettings.doctors.map((d) => ({
        doctorId: d.id,
        doctorName: d.name,
        doctorNum: d.stampNumber || '',
        doctorEESZTId: '',
      })),
    };

    clearOdontogramStorageKeys();
    const success = importData(JSON.stringify(payload));
    if (success) {
      const dateKey = getBudapestDateKey();
      patientOdontogramStates.forEach((state, patientId) => {
        saveCurrent(patientId, state);
        saveDailySnapshot(patientId, state, dateKey);
      });
      // Seed InvoiceSettings with defaults
      try {
        fetch('/backend/invoice-settings', {
          method: 'PUT',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceType: 'paper',
            defaultComment: '',
            defaultVatRate: 'TAM',
            defaultPaymentMethod: 'bankkártya',
            invoiceMode: 'test',
            agentKeyLive: '',
            agentKeyTest: '',
          }),
        });
      } catch { /* ignore */ }
      refreshData();
      refreshSettings();
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
      refreshSettings();
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

  const handleResetPriceLists = async () => {
    try {
      const res = await fetch('/backend/seed', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        refreshData();
        setMessage({ type: 'success', text: t.dataManagement.catalogOnly.resetSuccess });
      } else {
        setMessage({ type: 'error', text: 'Seed failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Seed failed' });
    }
    setResetPriceListConfirm(false);
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
      refreshSettings();
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

  const tabs: PageTab[] = [
    { key: 'overview', to: '/data', label: t.dataManagement.tabOverview, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { key: 'pricelist', to: '/data/pricelist', label: t.dataManagement.tabPricelist, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
    { key: 'patients', to: '/data/patients', label: t.dataManagement.tabPatients, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { key: 'storage', to: '/data/storage', label: t.dataManagement.tabStorage, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { key: 'database', to: '/data/database', label: t.dataManagement.tabDatabase, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> },
    { key: 'usage', to: '/data/usage', label: t.dataManagement.tabUsage, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
    { key: 'browser', to: '/data/browser', label: t.nav.dataBrowser, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
  ];

  const overviewCards: Array<{ key: DataSection; to: string; title: string; description: string; icon: React.ReactNode }> = [
    {
      key: 'pricelist',
      to: '/data/pricelist',
      title: t.dataManagement.catalogOnly.title,
      description: t.dataManagement.catalogOnly.description,
      icon: <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
    {
      key: 'patients',
      to: '/data/patients',
      title: t.dataManagement.patientData.title,
      description: t.dataManagement.overviewPatientDescription,
      icon: <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      key: 'storage',
      to: '/data/storage',
      title: t.dataManagement.storageInfoTitle,
      description: t.dataManagement.overviewStorageDescription,
      icon: <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      key: 'database',
      to: '/data/database',
      title: t.dataManagement.tabDatabase,
      description: t.dataManagement.overviewDatabaseDescription,
      icon: <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    },
    {
      key: 'usage',
      to: '/data/usage',
      title: t.dataManagement.usageTitle,
      description: t.dataManagement.usageDescription,
      icon: <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    },
  ];

  const browserCard = {
    to: '/data/browser',
    title: t.dataManagement.overviewBrowserTitle,
    description: t.dataManagement.overviewBrowserDescription,
    icon: <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">{t.dataManagement.title}</h1>
        <p className="text-theme-tertiary mt-1">{t.dataManagement.subtitle}</p>
      </div>

      <PageTabBar tabs={tabs} />

      <div className={section ? 'max-w-4xl space-y-6' : ''}>
      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
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

      {/* Overview card grid */}
      {!section && (
        <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overviewCards.map((card) => (
            <Link
              key={card.key}
              to={card.to}
              className="block rounded-lg border border-theme-primary bg-theme-secondary p-5 hover:border-dental-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">{card.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-theme-primary">{card.title}</h3>
                  <p className="text-xs text-theme-tertiary mt-1">{card.description}</p>
                </div>
              </div>
            </Link>
          ))}
          <Link
            to={browserCard.to}
            className="block rounded-lg border border-theme-primary bg-theme-secondary p-5 hover:border-dental-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">{browserCard.icon}</div>
              <div>
                <h3 className="text-sm font-semibold text-theme-primary">{browserCard.title}</h3>
                <p className="text-xs text-theme-tertiary mt-1">{browserCard.description}</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Pricelist Stats Card */}
      {section === 'pricelist' && (() => {
        const categoryStats = activePriceLists.map((pl) => {
          const cats = pricelistCategories.filter((c) => c.priceListId === pl.priceListId && c.isActive && !c.isDeleted);
          const catIds = new Set(cats.map(c => c.catalogCategoryId));
          const itemCount = pl.isNeak
            ? neakCatalog.filter((i) => catIds.has(i.catalogCategoryId) && !i.isDeleted).length
            : catalog.filter((i) => i.priceListId === pl.priceListId && !i.isDeleted).length;
          return { name: pl.priceListNameHu, categories: cats.length, items: itemCount };
        });
        const PIE_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#10b981'];
        const total = categoryStats.reduce((s, c) => s + c.items, 0) || 1;
        return (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t.dataManagement.pricelistStatsTitle}
              </h2>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-theme-tertiary">
                    <span className="text-sm text-theme-secondary">{t.dataManagement.pricelistStatsCount}</span>
                    <span className="text-lg font-bold text-theme-primary">{activePriceLists.length}</span>
                  </div>
                  {categoryStats.map((pl, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-theme-tertiary">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-sm text-theme-secondary">{pl.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-theme-primary">{pl.items} {t.dataManagement.pricelistStatsItems}</span>
                    </div>
                  ))}
                </div>
                {categoryStats.length > 0 && (
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs text-theme-tertiary mb-2">{t.dataManagement.pricelistStatsCategoryDistribution}</p>
                    <svg viewBox="0 0 120 120" className="w-36 h-36">
                      {(() => {
                        let offset = 0;
                        return categoryStats.map((pl, i) => {
                          const pct = pl.items / total;
                          const startAngle = offset * 2 * Math.PI;
                          offset += pct;
                          const endAngle = offset * 2 * Math.PI;
                          const largeArc = pct > 0.5 ? 1 : 0;
                          const x1 = 60 + 50 * Math.cos(startAngle - Math.PI / 2);
                          const y1 = 60 + 50 * Math.sin(startAngle - Math.PI / 2);
                          const x2 = 60 + 50 * Math.cos(endAngle - Math.PI / 2);
                          const y2 = 60 + 50 * Math.sin(endAngle - Math.PI / 2);
                          if (pct === 0) return null;
                          if (pct >= 0.999) return <circle key={i} cx="60" cy="60" r="50" fill={PIE_COLORS[i % PIE_COLORS.length]} />;
                          return <path key={i} d={`M60,60 L${x1},${y1} A50,50 0 ${largeArc},1 ${x2},${y2} Z`} fill={PIE_COLORS[i % PIE_COLORS.length]} />;
                        });
                      })()}
                    </svg>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Catalog-only Card */}
      {section === 'pricelist' && <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            {t.dataManagement.catalogOnly.title}
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-theme-secondary mb-4">{t.dataManagement.catalogOnly.description}</p>
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
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.export}</p>
                  <p className="text-xs text-theme-tertiary">{t.dataManagement.catalogOnly.exportDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="border border-theme-secondary rounded-md px-2 py-1 text-sm"
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

            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.import}</p>
                  <p className="text-xs text-theme-tertiary">{t.dataManagement.catalogOnly.importDescription}</p>
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
      </Card>}

      {/* Patient Stats Card */}
      {section === 'patients' && (() => {
        const allPatients = patientsFromContext;
        const active = allPatients.filter((p) => !p.isArchived);
        const deleted = allPatients.filter((p) => p.isArchived);
        const typeMap = new Map<string, number>();
        active.forEach((p) => {
          const type = p.patientType || t.dataManagement.patientStatsNoType;
          typeMap.set(type, (typeMap.get(type) || 0) + 1);
        });
        const typeEntries = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
        return (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {t.dataManagement.patientStatsTitle}
              </h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-theme-tertiary text-center">
                  <p className="text-2xl font-bold text-theme-primary">{allPatients.length}</p>
                  <p className="text-xs text-theme-tertiary">{t.dataManagement.patientStatsTotal}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{active.length}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{t.dataManagement.patientStatsActive}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{deleted.length}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">{t.dataManagement.patientStatsDeleted}</p>
                </div>
              </div>
              {typeEntries.length > 0 && (
                <>
                  <p className="text-sm font-medium text-theme-secondary mb-2">{t.dataManagement.patientStatsByType}</p>
                  <div className="space-y-2">
                    {typeEntries.map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between p-2 rounded bg-theme-tertiary">
                        <span className="text-sm text-theme-secondary">{type}</span>
                        <span className="text-sm font-semibold text-theme-primary">{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Patient Data Card */}
      {section === 'patients' && <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {t.dataManagement.patientData.title}
          </h2>
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
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5 text-theme-tertiary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.patientData.exportAllTitle}</p>
                    <p className="text-xs text-theme-tertiary">{t.dataManagement.patientData.exportAllDescription}</p>
                  </div>
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
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5 text-theme-tertiary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.patientData.exportSingleTitle}</p>
                    <p className="text-xs text-theme-tertiary">{t.dataManagement.patientData.exportSingleDescription}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="border border-theme-secondary rounded-md px-2 py-1 text-sm"
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
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5 text-theme-tertiary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0L16 8m4-4v12" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.patientData.importAllTitle}</p>
                    <p className="text-xs text-theme-tertiary">{t.dataManagement.patientData.importAllDescription}</p>
                  </div>
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
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5 text-theme-tertiary">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0L16 8m4-4v12" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.patientData.importSingleTitle}</p>
                    <p className="text-xs text-theme-tertiary">{t.dataManagement.patientData.importSingleDescription}</p>
                  </div>
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
      </Card>}

      {/* Full Database Card */}
      {section === 'database' && <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18M8 6v12M16 6v12" />
            </svg>
            {t.dataManagement.dbReportTitle}
          </h2>
        </CardHeader>
        <CardContent>
          <DatabaseReport />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            {t.dataManagement.databaseOnly.title}
          </h2>
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
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.export}</p>
                  <p className="text-xs text-theme-tertiary">{t.dataManagement.databaseOnly.exportDescription}</p>
                </div>
                <Button size="sm" onClick={handleExport}>
                  JSON
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-theme-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{t.dataManagement.import}</p>
                  <p className="text-xs text-theme-tertiary">{t.dataManagement.databaseOnly.importDescription}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={handleImportClick}>
                  JSON
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {t.dataManagement.databaseOnly.mockLoadTitle}
                  </p>
                  <p className="text-xs text-red-600">
                    {t.dataManagement.databaseOnly.mockLoadDescription}
                  </p>
                </div>
                <Button size="sm" variant="danger" onClick={() => setMockLoadConfirm(true)}>
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
      </>}

      {/* Storage Info */}
      {section === 'storage' && <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {t.dataManagement.storageInfoTitle}
          </h2>
        </CardHeader>
        <CardContent>
          <StorageInfo />
        </CardContent>
      </Card>}

      {section === 'usage' && <UsageSection />}

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
        isOpen={mockLoadConfirm}
        onClose={() => setMockLoadConfirm(false)}
        onConfirm={() => { setMockLoadConfirm(false); handleLoadMockData(); }}
        title={t.common.confirm}
        message={t.dataManagement.databaseOnly.mockLoadConfirm}
        confirmText={t.dataManagement.databaseOnly.mockLoadButton}
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
    </div>
  );
}

function StorageInfo() {
  const { t } = useSettings();
  const { patients, quotes, catalog, neakCatalog } = useApp();
  const { pricelists } = usePriceLists();
  const { allCategories } = usePriceListCategories();
  const { invoices } = useInvoices();

  const activePatients = patients.filter((p) => !p.isArchived);
  const archivedPatients = patients.filter((p) => p.isArchived);

  // Group patients by patientType
  const patientsByType: Record<string, number> = {};
  for (const p of activePatients) {
    const type = p.patientType || '-';
    patientsByType[type] = (patientsByType[type] || 0) + 1;
  }

  const activeQuotes = quotes.filter((q) => !q.isDeleted);
  const deletedQuotes = quotes.filter((q) => q.isDeleted);

  // Group quotes by status
  const quotesByStatus: Record<string, number> = {};
  for (const q of activeQuotes) {
    quotesByStatus[q.quoteStatus] = (quotesByStatus[q.quoteStatus] || 0) + 1;
  }

  const quoteStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: t.quotes.statusDraft,
      closed: t.quotes.statusClosed,
      rejected: t.quotes.statusRejected,
      started: t.quotes.statusStarted,
      completed: t.quotes.statusCompleted,
    };
    return map[status] || status;
  };

  // Invoice counts by type
  const normalInvoices = invoices.filter((inv) => !inv.invoiceType || inv.invoiceType === 'normal');
  const advanceInvoices = invoices.filter((inv) => inv.invoiceType === 'advance');
  const finalInvoices = invoices.filter((inv) => inv.invoiceType === 'final');
  const stornoInvoices = invoices.filter((inv) => inv.status === 'storno');

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="flex justify-between py-2 border-b border-theme-secondary">
      <span className="text-sm font-semibold text-theme-primary">{children}</span>
    </div>
  );

  const SubSectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="flex justify-between py-1.5 border-b border-theme-primary pl-4">
      <span className="text-sm font-semibold text-theme-secondary">{children}</span>
    </div>
  );

  const Row = ({ label, value, indent, indent2 }: { label: string; value: number; indent?: boolean; indent2?: boolean }) => (
    <div className={`flex justify-between py-1.5 border-b border-theme-primary ${indent2 ? 'pl-8' : indent ? 'pl-4' : ''}`}>
      <span className="text-sm text-theme-secondary">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {/* Patients */}
      <SectionHeader>{t.dataManagement.storageSectionPatients}</SectionHeader>
      <Row label={t.dataManagement.storagePatientsCount} value={activePatients.length} />
      {Object.entries(patientsByType)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => (
          <Row key={type} label={`${type}${t.dataManagement.storagePatientsCountByType}`} value={count} indent />
        ))}
      <Row label={t.dataManagement.storageDeletedPatients} value={archivedPatients.length} indent />

      {/* Quotes */}
      <SectionHeader>{t.dataManagement.storageSectionQuotes}</SectionHeader>
      <Row label={t.dataManagement.storageQuotesCount} value={activeQuotes.length} />
      {(['draft', 'closed', 'started', 'completed', 'rejected'] as const)
        .filter((status) => quotesByStatus[status])
        .map((status) => (
          <Row key={status} label={quoteStatusLabel(status)} value={quotesByStatus[status]} indent />
        ))}
      <Row label={t.dataManagement.storageDeletedQuotes} value={deletedQuotes.length} indent />

      {/* Price Lists */}
      <SectionHeader>{t.dataManagement.storageSectionPriceList}</SectionHeader>

      {/* Base Price List */}
      <SubSectionHeader>{t.dataManagement.storageSectionBasePriceList}</SubSectionHeader>
      <Row label={t.dataManagement.storagePriceListsCount} value={pricelists.filter(pl => !pl.isNeak).length} indent2 />
      <Row label={t.dataManagement.storagePriceListCategoriesCount} value={allCategories.filter(c => pricelists.some(pl => !pl.isNeak && pl.priceListId === c.priceListId)).length} indent2 />
      <Row label={t.dataManagement.storagePriceListItemsCount} value={catalog.length} indent2 />

      {/* NEAK Price List */}
      <SubSectionHeader>{t.dataManagement.storageSectionNeakPriceList}</SubSectionHeader>
      <Row label={t.dataManagement.storagePriceListsCount} value={pricelists.filter(pl => pl.isNeak).length} indent2 />
      <Row label={t.dataManagement.storagePriceListCategoriesCount} value={allCategories.filter(c => pricelists.some(pl => pl.isNeak && pl.priceListId === c.priceListId)).length} indent2 />
      <Row label={t.dataManagement.storagePriceListItemsCount} value={neakCatalog.length} indent2 />

      {/* Invoices */}
      <SectionHeader>{t.dataManagement.storageSectionInvoices}</SectionHeader>
      <Row label={t.dataManagement.storageSectionInvoices} value={invoices.length} />
      <Row label={t.dataManagement.storageInvoicesCount} value={normalInvoices.length} indent />
      <Row label={t.dataManagement.storageAdvanceInvoicesCount} value={advanceInvoices.length} indent />
      <Row label={t.dataManagement.storageFinalInvoicesCount} value={finalInvoices.length} indent />
      <Row label={t.dataManagement.storageStornoInvoicesCount} value={stornoInvoices.length} indent />
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
    return <p className="text-sm text-theme-tertiary">{t.dataManagement.dbReportLoading}</p>;
  }

  if (error || !stats) {
    return <p className="text-sm text-red-600">{error || t.dataManagement.dbReportError}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-theme-primary p-3">
        <p className="text-xs uppercase tracking-wide text-theme-tertiary">{t.dataManagement.dbReportDatabase}</p>
        <p className="mt-1 text-sm font-semibold text-theme-primary break-all leading-5">
          {stats.databaseName}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-theme-primary p-3">
          <p className="text-xs uppercase tracking-wide text-theme-tertiary">{t.dataManagement.dbReportTables}</p>
          <p className="mt-1 text-sm font-semibold text-theme-primary">{formatNumber(stats.tableCount)}</p>
        </div>
        <div className="rounded-lg border border-theme-primary p-3">
          <p className="text-xs uppercase tracking-wide text-theme-tertiary">{t.dataManagement.dbReportRows}</p>
          <p className="mt-1 text-sm font-semibold text-theme-primary">{formatNumber(stats.totalRows)}</p>
        </div>
        <div className="rounded-lg border border-theme-primary p-3">
          <p className="text-xs uppercase tracking-wide text-theme-tertiary">{t.dataManagement.dbReportSize}</p>
          <p className="mt-1 text-sm font-semibold text-theme-primary">{formatBytes(stats.databaseSizeBytes)}</p>
        </div>
      </div>

      <p className="text-xs text-theme-tertiary">
        {t.dataManagement.dbReportLastUpdated}: {new Date(stats.generatedAt).toLocaleString('hu-HU')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-theme-primary">
        <table className="min-w-full text-sm">
          <thead className="bg-theme-tertiary text-left text-xs uppercase tracking-wide text-theme-tertiary">
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
              <tr key={table.tableName} className="border-t border-theme-primary">
                <td className="px-3 py-2 font-medium">
                  <Link
                    to={`/data/browser?table=${encodeURIComponent(table.tableName)}`}
                    className="text-dental-600 hover:text-dental-800 hover:underline"
                  >
                    {table.tableName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right text-theme-secondary">{formatNumber(table.rowCount)}</td>
                <td className="px-3 py-2 text-right text-theme-secondary">{formatBytes(table.dataBytes)}</td>
                <td className="px-3 py-2 text-right text-theme-secondary">{formatBytes(table.indexBytes)}</td>
                <td className="px-3 py-2 text-right font-semibold text-theme-primary">{formatBytes(table.totalBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
