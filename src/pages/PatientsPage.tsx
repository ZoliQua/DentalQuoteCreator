import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { usePatients } from '../hooks';
import { Patient, PatientFormData } from '../types';
import iconFemale from '../assets/icon-svgs/symbol-female.svg';
import iconMale from '../assets/icon-svgs/symbol-male.svg';
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

export function PatientsPage() {
  const { t } = useSettings();
  const {
    activePatients,
    archivedPatients,
    createPatient,
    editPatient,
    deletePatient,
    archivePatient,
    restorePatient,
    searchPatients,
  } = usePatients();

  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    return searchPatients(searchQuery, showArchived);
  }, [searchPatients, searchQuery, showArchived]);

  const displayedPatients = showArchived ? archivedPatients : filteredPatients;

  const handleCreatePatient = (data: PatientFormData) => {
    createPatient(data);
    setIsModalOpen(false);
  };

  const handleEditPatient = (data: PatientFormData) => {
    if (editingPatient) {
      editPatient(editingPatient.patientId, data);
      setEditingPatient(null);
    }
  };

  const handleDelete = (patientId: string) => {
    deletePatient(patientId);
    setDeleteConfirm(null);
  };

  const getPatientAge = (birthDate: string): number | null => {
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    const dayDiff = now.getDate() - birth.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }
    return age < 0 ? null : age;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.patients.title}</h1>
          <p className="text-gray-500 mt-1">
            {activePatients.length} {t.common.active}, {archivedPatients.length} {t.common.archived}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.patients.newPatient}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t.patients.searchPlaceholder}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !showArchived ? 'bg-dental-100 text-dental-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.common.active}
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showArchived ? 'bg-dental-100 text-dental-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.common.archived}
          </button>
        </div>
      </div>

      {displayedPatients.length === 0 ? (
        <Card>
          <CardContent>
            {searchQuery ? (
              <EmptyState
                icon={<EmptySearchIcon />}
                title={t.common.noResults}
                description="Próbáljon más keresési kifejezést"
              />
            ) : (
              <EmptyState
                icon={<EmptyPatientIcon />}
                title={t.patients.noPatients}
                description="Adja hozzá az első pácienst a rendszerhez"
                actionLabel={t.patients.newPatient}
                onAction={() => setIsModalOpen(true)}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {displayedPatients.map((patient) => (
            <Card key={patient.patientId} hoverable>
              <CardContent className="flex items-center justify-between">
                <Link
                  to={`/patients/${patient.patientId}`}
                  className="flex-1 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-dental-100 flex items-center justify-center">
                    <span className="text-dental-700 font-semibold text-lg">
                      {patient.lastName[0]}
                      {patient.firstName[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {formatPatientName(patient.lastName, patient.firstName, patient.title)}
                      {getPatientAge(patient.birthDate) !== null && (
                        <span className="ml-2 text-sm font-medium text-gray-500">
                          ({getPatientAge(patient.birthDate)}
                          {(patient.sex === 'male' || patient.sex === 'female') && (
                            <img
                              src={patient.sex === 'male' ? iconMale : iconFemale}
                              alt={t.patients[patient.sex]}
                              className="ml-1 inline-block h-4 w-4 align-middle"
                            />
                          )}
                          )
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{formatDate(patient.birthDate)}</span>
                      {patient.insuranceNum && <span>TAJ: {patient.insuranceNum}</span>}
                      {patient.phone && <span>{patient.phone}</span>}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {showArchived ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        restorePatient(patient.patientId);
                      }}
                    >
                      {t.common.restore}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPatient(patient);
                        }}
                      >
                        {t.common.edit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          archivePatient(patient.patientId);
                        }}
                      >
                        {t.common.archive}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(patient.patientId);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {t.common.delete}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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

function PatientFormModal({ isOpen, onClose, onSubmit, patient, title }: PatientFormModalProps) {
  const { t, settings } = useSettings();
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

    const tajState = getTajValidationState(formData.insuranceNum || '');
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

  const handleInsuranceNumChange = (value: string) => {
    const formatted = formatInsuranceNum(value);
    setFormData({ ...formData, insuranceNum: formatted });
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

        {/* Row 2: Birth Date, Birth Place */}
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

        {/* Row 3: Sex, TAJ */}
        <div className="grid grid-cols-2 gap-4">
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
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.insuranceNum}
            </label>
            <input
              value={formData.insuranceNum || ''}
              onChange={(e) => handleInsuranceNumChange(e.target.value)}
              placeholder={t.patients.insuranceNumPlaceholder}
              maxLength={11}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                (() => {
                  const state = getTajValidationState(formData.insuranceNum || '');
                  if (state === 'empty') return 'border-gray-300 focus:ring-dental-500';
                  if (state === 'incomplete') return 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500';
                  if (state === 'valid') return 'border-green-500 bg-green-50 focus:ring-green-500';
                  return 'border-red-500 bg-red-50 focus:ring-red-500';
                })()
              }`}
            />
            {getTajValidationState(formData.insuranceNum || '') === 'invalid' && (
              <p className="mt-1 text-sm text-red-600">{t.validation.invalidInsuranceNum}</p>
            )}
            {getTajValidationState(formData.insuranceNum || '') === 'valid' && (
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

        {/* Row 7: Patient Type */}
        {settings.patient.patientTypes.length > 0 && (
          <Select
            label={t.patients.patientType}
            value={formData.patientType || ''}
            onChange={(e) => setFormData({ ...formData, patientType: e.target.value })}
            options={settings.patient.patientTypes.map((pt) => ({ value: pt, label: pt }))}
          />
        )}

        {/* Row 8: Notes */}
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
    </Modal>
  );
}
