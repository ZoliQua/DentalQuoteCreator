import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAppointments } from '../hooks/useAppointments';
import { Button, Card, CardContent, CardHeader, Input, Modal } from '../components/common';
import type { AppointmentType } from '../types';

export function AppointmentTypesPage() {
  const { t, appLanguage } = useSettings();
  const {
    appointmentTypes,
    fetchAppointmentTypes,
    createAppointmentType,
    updateAppointmentType,
    deleteAppointmentType,
  } = useAppointments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentType | null>(null);
  const [form, setForm] = useState({
    nameHu: '',
    nameEn: '',
    nameDe: '',
    color: '#3B82F6',
    defaultDurationMin: 30,
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchAppointmentTypes();
  }, [fetchAppointmentTypes]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      nameHu: '',
      nameEn: '',
      nameDe: '',
      color: '#3B82F6',
      defaultDurationMin: 30,
      sortOrder: (appointmentTypes.length + 1) * 10,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (type: AppointmentType) => {
    setEditing(type);
    setForm({
      nameHu: type.nameHu,
      nameEn: type.nameEn,
      nameDe: type.nameDe,
      color: type.color,
      defaultDurationMin: type.defaultDurationMin,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await updateAppointmentType(editing.typeId, form);
    } else {
      await createAppointmentType(form);
    }
    setModalOpen(false);
    fetchAppointmentTypes();
  };

  const handleDelete = async (type: AppointmentType) => {
    if (type.isSystem) return;
    if (!confirm(t.calendar.deleteConfirm)) return;
    await deleteAppointmentType(type.typeId);
    fetchAppointmentTypes();
  };

  const getTypeName = (type: AppointmentType) => {
    if (appLanguage === 'en' && type.nameEn) return type.nameEn;
    if (appLanguage === 'de' && type.nameDe) return type.nameDe;
    return type.nameHu;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.calendar.typesTitle}</h1>
        <Button onClick={openCreate}>{t.calendar.addType}</Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t.calendar.typesTitle}</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t.calendar.typeColor}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t.calendar.typeName}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t.calendar.typeDefaultDuration}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t.calendar.status}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {appointmentTypes.map((type) => (
                  <tr key={type.typeId} className={type.isActive ? '' : 'opacity-50'}>
                    <td className="px-4 py-3">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-200"
                        style={{ backgroundColor: type.color }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {getTypeName(type)}
                      {type.isSystem && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {t.calendar.typeSystem}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {type.defaultDurationMin} {t.calendar.minutes}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          type.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {type.isActive ? t.common.active : t.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(type)}>
                          {t.common.edit}
                        </Button>
                        {!type.isSystem && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(type)}
                          >
                            {t.common.delete}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t.calendar.editType : t.calendar.addType}
      >
        <div className="space-y-4">
          <Input
            label={`${t.calendar.typeName} (HU)`}
            value={form.nameHu}
            onChange={(e) => setForm({ ...form, nameHu: e.target.value })}
          />
          <Input
            label={`${t.calendar.typeName} (EN)`}
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
          <Input
            label={`${t.calendar.typeName} (DE)`}
            value={form.nameDe}
            onChange={(e) => setForm({ ...form, nameDe: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.calendar.typeColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <Input
              label={`${t.calendar.typeDefaultDuration} (${t.calendar.minutes})`}
              type="number"
              value={String(form.defaultDurationMin)}
              onChange={(e) => setForm({ ...form, defaultDurationMin: Number(e.target.value) || 30 })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sort order"
              type="number"
              value={String(form.sortOrder)}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{t.common.active}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={!form.nameHu}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
