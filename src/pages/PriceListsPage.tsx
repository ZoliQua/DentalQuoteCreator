import { useState, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePriceLists } from '../hooks';
import { PriceList } from '../types';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  EmptyCatalogIcon,
  ConfirmModal,
} from '../components/common';
import { Modal, Input } from '../components/common';

export function PriceListsPage() {
  const { t } = useSettings();
  const { hasPermission } = useAuth();
  const {
    pricelists,
    activePriceLists,
    createPriceList,
    editPriceList,
    setDefaultPriceList,
    deletePriceList,
  } = usePriceLists();

  const [showDeleted, setShowDeleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceList | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    priceListNameHu: '',
    priceListNameEn: '',
    priceListNameDe: '',
    isActive: true,
    isDefault: false,
    isUserLocked: false,
    isDeleted: false,
    listOfUsers: [] as string[],
  });

  const openCreateModal = () => {
    setFormData({
      priceListNameHu: '',
      priceListNameEn: '',
      priceListNameDe: '',
      isActive: true,
      isDefault: false,
      isUserLocked: false,
      isDeleted: false,
      listOfUsers: [],
    });
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: PriceList) => {
    setFormData({
      priceListNameHu: item.priceListNameHu,
      priceListNameEn: item.priceListNameEn,
      priceListNameDe: item.priceListNameDe,
      isActive: item.isActive,
      isDefault: item.isDefault,
      isUserLocked: item.isUserLocked,
      isDeleted: item.isDeleted,
      listOfUsers: item.listOfUsers,
    });
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      editPriceList(editingItem.priceListId, formData);
    } else {
      createPriceList(formData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (priceListId: string) => {
    deletePriceList(priceListId);
    setDeleteConfirm(null);
  };

  const displayList = useMemo(
    () => pricelists.filter((pl) => showDeleted ? pl.isDeleted : !pl.isDeleted),
    [pricelists, showDeleted]
  );

  const deletedCount = useMemo(
    () => pricelists.filter((pl) => pl.isDeleted).length,
    [pricelists]
  );

  const handleRestore = (priceListId: string) => {
    editPriceList(priceListId, { isDeleted: false });
    setRestoreConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.priceList.title}</h1>
          <p className="text-gray-500 mt-1">
            {activePriceLists.length} {t.common.active}{deletedCount > 0 ? `, ${deletedCount} ${t.common.deleted}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleted(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !showDeleted ? 'bg-dental-100 text-dental-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.common.active}
            </button>
            {hasPermission('pricelist.restore') && (
              <button
                onClick={() => setShowDeleted(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showDeleted ? 'bg-dental-100 text-dental-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t.common.deleted}
              </button>
            )}
          </div>
          {!showDeleted && hasPermission('pricelist.create') && (
            <Button onClick={openCreateModal}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.priceList.newPriceList}
            </Button>
          )}
        </div>
      </div>

      {displayList.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<EmptyCatalogIcon />}
              title={showDeleted ? t.priceList.noDeletedItems : t.priceList.noItems}
              actionLabel={!showDeleted && hasPermission('pricelist.create') ? t.priceList.newPriceList : undefined}
              onAction={!showDeleted && hasPermission('pricelist.create') ? openCreateModal : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">{t.priceList.nameHu}</th>
                    <th className="pb-3 font-medium">{t.priceList.nameEn}</th>
                    <th className="pb-3 font-medium">{t.priceList.nameDe}</th>
                    <th className="pb-3 font-medium text-center">{t.priceList.isDefault}</th>
                    <th className="pb-3 font-medium text-center">{t.priceList.isActive}</th>
                    <th className="pb-3 font-medium text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((item) => (
                    <tr key={item.priceListId} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.priceListNameHu}</td>
                      <td className="py-3 text-gray-600">{item.priceListNameEn}</td>
                      <td className="py-3 text-gray-600">{item.priceListNameDe}</td>
                      <td className="py-3 text-center">
                        {item.isDefault ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {t.priceList.isDefault}
                          </span>
                        ) : hasPermission('pricelist.update') ? (
                          <button
                            onClick={() => setDefaultPriceList(item.priceListId)}
                            className="text-xs text-gray-400 hover:text-dental-600"
                          >
                            {t.priceList.setDefault}
                          </button>
                        ) : null}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.isActive ? t.common.active : 'Inaktív'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {showDeleted ? (
                            <button
                              onClick={() => setRestoreConfirm(item.priceListId)}
                              title={t.common.restore}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          ) : (
                            <>
                              {hasPermission('pricelist.update') && (
                                <button
                                  onClick={() => openEditModal(item)}
                                  title={t.common.edit}
                                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              )}
                              {hasPermission('pricelist.delete') && !item.isDefault && (
                                <button
                                  onClick={() => setDeleteConfirm(item.priceListId)}
                                  title={t.common.delete}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        title={editingItem ? t.priceList.editPriceList : t.priceList.newPriceList}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t.priceList.nameHu}
            value={formData.priceListNameHu}
            onChange={(e) => setFormData({ ...formData, priceListNameHu: e.target.value })}
            required
          />
          <Input
            label={t.priceList.nameEn}
            value={formData.priceListNameEn}
            onChange={(e) => setFormData({ ...formData, priceListNameEn: e.target.value })}
          />
          <Input
            label={t.priceList.nameDe}
            value={formData.priceListNameDe}
            onChange={(e) => setFormData({ ...formData, priceListNameDe: e.target.value })}
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-dental-600 rounded focus:ring-dental-500"
              />
              {t.priceList.isActive}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-dental-600 rounded focus:ring-dental-500"
              />
              {t.priceList.isDefault}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.isUserLocked}
                onChange={(e) => setFormData({ ...formData, isUserLocked: e.target.checked })}
                className="w-4 h-4 text-dental-600 rounded focus:ring-dental-500"
              />
              {t.priceList.isUserLocked}
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsModalOpen(false); setEditingItem(null); }}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{t.common.save}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title={t.common.confirm}
        message={t.priceList.deleteConfirm}
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
        message={t.priceList.restoreConfirm}
        confirmText={t.common.restore}
        cancelText={t.common.cancel}
      />
    </div>
  );
}
