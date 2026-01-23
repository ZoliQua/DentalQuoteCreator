import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
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
import { formatDate, formatInsuranceNum, formatPatientName, getTajValidationState } from '../utils';

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
                      {formatPatientName(patient.lastName, patient.firstName)}
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
  const { t } = useSettings();
  const [formData, setFormData] = useState<PatientFormData>({
    lastName: patient?.lastName || '',
    firstName: patient?.firstName || '',
    sex: patient?.sex || 'male',
    birthDate: patient?.birthDate || '',
    insuranceNum: patient?.insuranceNum || '',
    phone: patient?.phone || '',
    email: patient?.email || '',
    address: patient?.address || '',
    notes: patient?.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (patient) {
      setFormData({
        lastName: patient.lastName,
        firstName: patient.firstName,
        sex: patient.sex,
        birthDate: patient.birthDate,
        insuranceNum: patient.insuranceNum || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        notes: patient.notes || '',
      });
    } else if (isOpen) {
      setFormData({
        lastName: '',
        firstName: '',
        sex: 'male',
        birthDate: '',
        insuranceNum: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
      });
    }
    if (isOpen) {
      setErrors({});
    }
  }, [patient, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.lastName.trim()) newErrors.lastName = t.validation.required;
    if (!formData.firstName.trim()) newErrors.firstName = t.validation.required;
    if (!formData.birthDate) newErrors.birthDate = t.validation.required;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
    onClose();
  };

  const handleInsuranceNumChange = (value: string) => {
    const formatted = formatInsuranceNum(value);
    setFormData({ ...formData, insuranceNum: formatted });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.patients.lastName}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            error={errors.lastName}
            required
          />
          <Input
            label={t.patients.firstName}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            error={errors.firstName}
            required
          />
        </div>

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
          <Input
            label={t.patients.birthDate}
            type="date"
            value={formData.birthDate}
            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            error={errors.birthDate}
            required
          />
        </div>

        {/* TAJ with validation feedback */}
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
            <p className="mt-1 text-sm text-green-600">TAJ szám érvényes</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.patients.phone}
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label={t.patients.email}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <Input
          label={t.patients.address}
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />

        <TextArea
          label={t.patients.notes}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />

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
