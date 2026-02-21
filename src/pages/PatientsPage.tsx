import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePatients } from '../hooks';
import { Patient, PatientFormData } from '../types';
import {
  Button,
  Card,
  CardContent,
  SearchInput,
  Modal,
  Input,
  Select,
  TextArea,
  EmptyState,
  EmptyPatientIcon,
  EmptySearchIcon,
  ConfirmModal,
} from '../components/common';
import { formatDate, formatInsuranceNum, formatPatientName, getTajValidationState, formatBirthDateForDisplay, parseBirthDateFromDisplay, getDatePlaceholder } from '../utils';
import { postalCodes } from '../data/postalCodes';
import { NeakCheckModal } from '../modules/neak/NeakCheckModal';
import { checkJogviszony, saveCheck } from '../modules/neak';

type PatientSortColumn = 'patientId' | 'name' | 'birthDate' | 'phone' | 'insuranceNum' | 'tag';
type SortDirection = 'asc' | 'desc';

export function PatientsPage({ showDeleted }: { showDeleted?: boolean }) {
  const { t, settings } = useSettings();
  const { hasPermission } = useAuth();
  const {
    activePatients,
    archivedPatients,
    createPatient,
    editPatient,
    deletePatient,
    restorePatient,
  } = usePatients();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<PatientSortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = settings.patient?.perPage || 50;

  const basePatients = showDeleted ? archivedPatients : activePatients;

  const filteredPatients = useMemo(() => {
    let result = basePatients;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.lastName.toLowerCase().includes(query) ||
        p.firstName.toLowerCase().includes(query) ||
        `${p.lastName} ${p.firstName}`.toLowerCase().includes(query) ||
        (p.insuranceNum && p.insuranceNum.includes(query)) ||
        (p.phone && p.phone.includes(query)) ||
        p.patientId.includes(query)
      );
    }

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'patientId':
          cmp = a.patientId.localeCompare(b.patientId);
          break;
        case 'name':
          cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
          break;
        case 'birthDate':
          cmp = new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime();
          break;
        case 'phone':
          cmp = (a.phone || '').localeCompare(b.phone || '');
          break;
        case 'insuranceNum':
          cmp = (a.insuranceNum || '').localeCompare(b.insuranceNum || '');
          break;
        case 'tag':
          cmp = (a.patientType || '').localeCompare(b.patientType || '');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [basePatients, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / perPage));
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleSort = (column: PatientSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortArrow = ({ column }: { column: PatientSortColumn }) => (
    <span className="ml-1 inline-block w-3">
      {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </span>
  );

  const ThSortable = ({ column, children }: { column: PatientSortColumn; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(column)}
    >
      {children}
      <SortArrow column={column} />
    </th>
  );

  const getTagBadge = (patientType?: string) => {
    if (!patientType) return null;
    const isNeak = patientType.toLowerCase().includes('neak');
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        isNeak ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
      }`}>
        {isNeak ? t.patients.tagNeak : t.patients.tagPrivate}
      </span>
    );
  };

  const handleCreatePatient = (data: PatientFormData) => {
    const newPatient = createPatient(data);
    setIsModalOpen(false);
    const tajDigits = data.insuranceNum?.replace(/-/g, '') || '';
    if (data.patientType?.toLowerCase().includes('neak') && tajDigits.length === 9 && newPatient) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      checkJogviszony(tajDigits, date).then(result => {
        saveCheck({ id: nanoid(), patientId: newPatient.patientId, taj: tajDigits, checkedAt: new Date().toISOString(), date, result });
      }).catch(() => {});
    }
  };

  const handleEditPatient = (data: PatientFormData) => {
    if (editingPatient) {
      editPatient(editingPatient.patientId, data);
      const tajDigits = data.insuranceNum?.replace(/-/g, '') || '';
      if (data.patientType?.toLowerCase().includes('neak') && tajDigits.length === 9) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        checkJogviszony(tajDigits, date).then(result => {
          saveCheck({ id: nanoid(), patientId: editingPatient.patientId, taj: tajDigits, checkedAt: new Date().toISOString(), date, result });
        }).catch(() => {});
      }
      setEditingPatient(null);
    }
  };

  const handleDelete = (patientId: string) => {
    deletePatient(patientId);
    setDeleteConfirm(null);
  };

  const handleRestore = (patientId: string) => {
    restorePatient(patientId);
    setRestoreConfirm(null);
  };

  const pageTitle = showDeleted ? t.nav.patientsDeleted : t.patients.title;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-gray-500 mt-1">
            {filteredPatients.length} {showDeleted ? t.common.archived : t.common.active}
          </p>
        </div>
        {!showDeleted && hasPermission('patients.create') && (
          <Button onClick={() => setIsModalOpen(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.patients.newPatient}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          placeholder={t.patients.searchPlaceholder}
          className="flex-1"
        />
      </div>

      {filteredPatients.length === 0 ? (
        <Card>
          <CardContent>
            {searchQuery ? (
              <EmptyState
                icon={<EmptySearchIcon />}
                title={t.common.noResults}
                description={t.patients.tryDifferentSearch}
              />
            ) : (
              <EmptyState
                icon={<EmptyPatientIcon />}
                title={t.patients.noPatients}
                description={t.patients.addFirstPatient}
                actionLabel={!showDeleted ? t.patients.newPatient : undefined}
                onAction={!showDeleted ? () => setIsModalOpen(true) : undefined}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <ThSortable column="patientId">{t.patients.patientDisplayId}</ThSortable>
                  <ThSortable column="name">{t.patients.name}</ThSortable>
                  <ThSortable column="birthDate">{t.patients.birthDate}</ThSortable>
                  <ThSortable column="phone">{t.patients.phone}</ThSortable>
                  <ThSortable column="insuranceNum">TAJ</ThSortable>
                  <ThSortable column="tag">{t.patients.tag}</ThSortable>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedPatients.map((patient) => (
                  <tr key={patient.patientId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {patient.patientId}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/patients/${patient.patientId}`}
                        className="text-dental-600 hover:text-dental-700 font-medium"
                      >
                        {formatPatientName(patient.lastName, patient.firstName, patient.title)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(patient.birthDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {patient.phone || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {patient.insuranceNum || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getTagBadge(patient.patientType)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {showDeleted ? (
                          <>
                            <button
                              onClick={() => setRestoreConfirm(patient.patientId)}
                              title={t.common.restore}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
                              </svg>
                            </button>
                            {hasPermission('patients.update') && (
                              <button
                                onClick={() => setEditingPatient(patient)}
                                title={t.common.edit}
                                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {hasPermission('patients.update') && (
                              <button
                                onClick={() => setEditingPatient(patient)}
                                title={t.common.edit}
                                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {hasPermission('patients.delete') && (
                              <button
                                onClick={() => setDeleteConfirm(patient.patientId)}
                                title={t.common.delete}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredPatients.length)} / {filteredPatients.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  &laquo;
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create/Edit Modal */}
      <PatientFormModal
        isOpen={isModalOpen || editingPatient !== null}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPatient(null);
        }}
        onSubmit={editingPatient ? handleEditPatient : handleCreatePatient}
        patient={editingPatient || undefined}
        title={editingPatient ? t.patients.editPatient : t.patients.newPatient}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title={t.common.confirm}
        message={t.patients.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Restore Confirmation */}
      <ConfirmModal
        isOpen={restoreConfirm !== null}
        onClose={() => setRestoreConfirm(null)}
        onConfirm={() => restoreConfirm && handleRestore(restoreConfirm)}
        title={t.common.confirm}
        message={t.quotes.restoreConfirm}
        confirmText={t.common.restore}
        cancelText={t.common.cancel}
        variant="primary"
      />
    </div>
  );
}

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PatientFormData) => void;
  patient?: Patient;
  title: string;
}

export function PatientFormModal({ isOpen, onClose, onSubmit, patient, title }: PatientFormModalProps) {
  const { t, settings } = useSettings();
  const [neakModalOpen, setNeakModalOpen] = useState(false);
  const [formData, setFormData] = useState<PatientFormData>({
    title: '',
    lastName: '',
    firstName: '',
    sex: 'male',
    birthDate: '',
    birthPlace: '',
    insuranceNum: '',
    phone: '',
    email: '',
    country: settings.patient.defaultCountry,
    isForeignAddress: false,
    zipCode: '',
    city: '',
    street: '',
    patientType: settings.patient.patientTypes[0] || '',
    notes: '',
    mothersName: '',
    neakDocumentType: 1,
    patientVATName: '',
    patientVATNumber: '',
    patientDiscount: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [birthDateText, setBirthDateText] = useState('');

  useEffect(() => {
    if (patient) {
      setFormData({
        title: patient.title || '',
        lastName: patient.lastName,
        firstName: patient.firstName,
        sex: patient.sex,
        birthDate: patient.birthDate,
        birthPlace: patient.birthPlace || '',
        insuranceNum: patient.insuranceNum || '',
        phone: patient.phone || '',
        email: patient.email || '',
        country: patient.country || settings.patient.defaultCountry,
        isForeignAddress: patient.isForeignAddress || false,
        zipCode: patient.zipCode || '',
        city: patient.city || '',
        street: patient.street || '',
        patientType: patient.patientType || settings.patient.patientTypes[0] || '',
        notes: patient.notes || '',
        mothersName: patient.mothersName || '',
        neakDocumentType: patient.neakDocumentType ?? 1,
        patientVATName: patient.patientVATName || '',
        patientVATNumber: patient.patientVATNumber || '',
        patientDiscount: patient.patientDiscount ?? null,
      });
      setBirthDateText(formatBirthDateForDisplay(patient.birthDate));
    } else if (isOpen) {
      setFormData({
        title: '',
        lastName: '',
        firstName: '',
        sex: 'male',
        birthDate: '',
        birthPlace: '',
        insuranceNum: '',
        phone: '',
        email: '',
        country: settings.patient.defaultCountry,
        isForeignAddress: false,
        zipCode: '',
        city: '',
        street: '',
        patientType: settings.patient.patientTypes[0] || '',
        notes: '',
        mothersName: '',
        neakDocumentType: 1,
        patientVATName: '',
        patientVATNumber: '',
        patientDiscount: null,
      });
      setBirthDateText('');
    }
    if (isOpen) {
      setErrors({});
      setCitySuggestions([]);
    }
  }, [patient, isOpen, settings.patient.defaultCountry, settings.patient.patientTypes]);

  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.lastName.trim()) newErrors.lastName = t.validation.required;
    if (!formData.firstName.trim()) newErrors.firstName = t.validation.required;
    if (!formData.birthDate) newErrors.birthDate = t.validation.required;
    if (!formData.zipCode?.trim()) newErrors.zipCode = t.validation.required;
    if (!formData.city?.trim()) newErrors.city = t.validation.required;
    if (!formData.street?.trim()) newErrors.street = t.validation.required;

    const tajState = getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType);
    if (tajState !== 'empty' && tajState !== 'valid') {
      newErrors.insuranceNum = t.validation.invalidInsuranceNum;
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = t.validation.invalidEmail;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
    onClose();
  };

  const handleBirthDateTextChange = (value: string) => {
    setBirthDateText(value);
    const parsed = parseBirthDateFromDisplay(value);
    if (parsed) {
      setFormData((prev) => ({ ...prev, birthDate: parsed }));
    } else if (!value) {
      setFormData((prev) => ({ ...prev, birthDate: '' }));
    }
  };


  const handleZipCodeChange = (value: string) => {
    const zip = value.replace(/\D/g, '').slice(0, 4);
    const next = { ...formData, zipCode: zip };

    if (!formData.isForeignAddress && zip.length === 4) {
      const settlements = postalCodes[zip];
      if (settlements?.length === 1) {
        next.city = settlements[0];
        setCitySuggestions([]);
      } else if (settlements && settlements.length > 1) {
        setCitySuggestions(settlements);
      } else {
        setCitySuggestions([]);
      }
    } else {
      setCitySuggestions([]);
    }

    setFormData(next);
  };

  const handleForeignToggle = (checked: boolean) => {
    setFormData({
      ...formData,
      isForeignAddress: checked,
      country: checked ? '' : settings.patient.defaultCountry,
    });
    setCitySuggestions([]);
  };

  const titleOptions = ['', 'Dr.', 'Prof.', 'id.', 'ifj.', 'özv.'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Title, Last Name, First Name */}
        <div className="flex gap-4">
          <div className="w-20 shrink-0 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.titleLabel}
            </label>
            <select
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full min-w-0 px-1 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300 text-sm"
            >
              {titleOptions.map((v) => (
                <option key={v} value={v}>{v || '—'}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <Input
              label={t.patients.lastName}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              error={errors.lastName}
              required
            />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              label={t.patients.firstName}
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              error={errors.firstName}
              required
            />
          </div>
        </div>

        {/* Row 2: Mother's Name, Sex */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.patients.mothersName}
            value={formData.mothersName || ''}
            onChange={(e) => setFormData({ ...formData, mothersName: e.target.value })}
          />
          <Select
            label={t.patients.sex}
            value={formData.sex}
            onChange={(e) =>
              setFormData({ ...formData, sex: e.target.value as 'male' | 'female' | 'other' })
            }
            options={[
              { value: 'male', label: t.patients.male },
              { value: 'female', label: t.patients.female },
              { value: 'other', label: t.patients.other },
            ]}
            required
          />
        </div>

        {/* Row 3: Birth Date, Birth Place */}
        <div className="grid grid-cols-2 gap-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.birthDate}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                value={birthDateText}
                onChange={(e) => handleBirthDateTextChange(e.target.value)}
                placeholder={getDatePlaceholder()}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors ${
                  errors.birthDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setFormData((prev) => ({ ...prev, birthDate: val }));
                    setBirthDateText(formatBirthDateForDisplay(val));
                  }
                }}
                className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                tabIndex={-1}
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            {errors.birthDate && <p className="mt-1 text-sm text-red-600">{errors.birthDate}</p>}
          </div>
          <Input
            label={t.patients.birthPlace}
            value={formData.birthPlace || ''}
            onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
          />
        </div>

        {/* Row 4: NEAK Document Type, TAJ */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.patients.neakDocumentType}
            value={String(formData.neakDocumentType ?? 1)}
            onChange={(e) =>
              setFormData({ ...formData, neakDocumentType: Number(e.target.value) })
            }
            options={[
              { value: '0', label: t.patients.neakDocType0 },
              { value: '1', label: t.patients.neakDocType1 },
              { value: '2', label: t.patients.neakDocType2 },
              { value: '3', label: t.patients.neakDocType3 },
              { value: '5', label: t.patients.neakDocType5 },
              { value: '6', label: t.patients.neakDocType6 },
              { value: '7', label: t.patients.neakDocType7 },
              { value: '8', label: t.patients.neakDocType8 },
              { value: '9', label: t.patients.neakDocType9 },
            ]}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.insuranceNum}
            </label>
            <div className="flex gap-1">
              <input
                value={formData.insuranceNum || ''}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceNum: formData.neakDocumentType === 1 ? formatInsuranceNum(e.target.value) : e.target.value })
                }
                placeholder={formData.neakDocumentType === 1 ? t.patients.insuranceNumPlaceholder : ''}
                maxLength={formData.neakDocumentType === 1 ? 11 : undefined}
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  (() => {
                    const state = getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType);
                    if (state === 'empty') return 'border-gray-300 focus:ring-dental-500';
                    if (state === 'incomplete') return 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500';
                    if (state === 'valid') return 'border-green-500 bg-green-50 focus:ring-green-500';
                    return 'border-red-500 bg-red-50 focus:ring-red-500';
                  })()
                }`}
              />
              {formData.neakDocumentType === 1 && formData.patientType?.toLowerCase().includes('neak') &&
                getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType) === 'valid' && (
                <button
                  type="button"
                  onClick={() => setNeakModalOpen(true)}
                  className="shrink-0 rounded-lg border border-gray-300 p-2 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
                  title={t.neak.checkButton}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </button>
              )}
            </div>
            {formData.neakDocumentType === 1 && getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType) === 'invalid' && (
              <p className="mt-1 text-sm text-red-600">{t.validation.invalidInsuranceNum}</p>
            )}
            {getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType) === 'valid' && (
              <p className="mt-1 text-sm text-green-600">{t.patients.tajValid}</p>
            )}
            {errors.insuranceNum && (
              <p className="mt-1 text-sm text-red-600">{errors.insuranceNum}</p>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.patients.addressSection}</h3>

          {/* Row 4: Country, Zip, City, Foreign toggle */}
          <div className="grid grid-cols-[1fr_8rem_1fr_auto] gap-4 items-end">
            <Input
              label={t.patients.country}
              value={formData.country || ''}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              readOnly={!formData.isForeignAddress}
              className={!formData.isForeignAddress ? 'bg-gray-50' : ''}
            />
            <Input
              label={t.patients.zipCode}
              value={formData.zipCode || ''}
              onChange={(e) => handleZipCodeChange(e.target.value)}
              placeholder="9700"
              maxLength={4}
              error={errors.zipCode}
              required
            />
            <div>
              {citySuggestions.length > 1 ? (
                <Select
                  label={t.patients.city}
                  value={formData.city || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, city: e.target.value });
                    setCitySuggestions([]);
                  }}
                  options={citySuggestions.map((s) => ({ value: s, label: s }))}
                  error={errors.city}
                  required
                />
              ) : (
                <Input
                  label={t.patients.city}
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  error={errors.city}
                  required
                />
              )}
            </div>
            <label className="flex items-center gap-2 mb-1 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={formData.isForeignAddress || false}
                onChange={(e) => handleForeignToggle(e.target.checked)}
                className="rounded border-gray-300 text-dental-600 focus:ring-dental-500"
              />
              <span className="text-sm text-gray-700">{t.patients.foreignAddress}</span>
            </label>
          </div>

          {/* Row 5: Street */}
          <div className="mt-3">
            <Input
              label={t.patients.street}
              value={formData.street || ''}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              placeholder="Fő tér 1."
              error={errors.street}
              required
            />
          </div>
        </div>

        {/* Contact Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.patients.contactInfo}</h3>

          {/* Row 6: Phone, Email */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.patients.phone}
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label={t.patients.email}
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
            />
          </div>
        </div>

        {/* Billing Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.patients.billingSection}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.patients.patientVATName}
              value={formData.patientVATName || ''}
              onChange={(e) => setFormData({ ...formData, patientVATName: e.target.value })}
            />
            <Input
              label={t.patients.patientVATNumber}
              value={formData.patientVATNumber || ''}
              onChange={(e) => setFormData({ ...formData, patientVATNumber: e.target.value })}
            />
          </div>
        </div>

        {/* Patient Characteristics Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.patients.characteristicsSection}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t.patients.patientDiscount}
              value={formData.patientDiscount != null ? String(formData.patientDiscount) : ''}
              onChange={(e) =>
                setFormData({ ...formData, patientDiscount: e.target.value ? Number(e.target.value) : null })
              }
              options={[
                { value: '', label: t.patients.noDiscount },
                { value: '5', label: '5%' },
                { value: '10', label: '10%' },
                { value: '15', label: '15%' },
                { value: '20', label: '20%' },
                { value: '25', label: '25%' },
                { value: '30', label: '30%' },
                { value: '50', label: '50%' },
              ]}
            />
            {settings.patient.patientTypes.length > 0 && (
              <Select
                label={t.patients.patientType}
                value={formData.patientType || ''}
                onChange={(e) => setFormData({ ...formData, patientType: e.target.value })}
                options={settings.patient.patientTypes.map((pt) => ({ value: pt, label: pt }))}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        <TextArea
          label={t.patients.notes}
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />

        {/* Validation warning */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-700">{t.patients.missingFieldsTitle}</p>
            <p className="text-sm text-red-600">{t.patients.missingFieldsMessage}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.save}</Button>
        </div>
      </form>
      {neakModalOpen && (
        <NeakCheckModal
          isOpen={neakModalOpen}
          onClose={() => setNeakModalOpen(false)}
          patientId={patient?.patientId || 'new'}
          taj={formData.insuranceNum || ''}
          patientName={`${formData.lastName} ${formData.firstName}`.trim()}
        />
      )}
    </Modal>
  );
}
