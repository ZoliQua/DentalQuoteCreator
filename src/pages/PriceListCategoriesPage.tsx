import { useState, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePriceLists, usePriceListCategories } from '../hooks';
import { PriceListCategory } from '../types';
import { getPriceListDisplayName } from '../utils/catalogLocale';
import {
  Button,
  Card,
  CardContent,
  Select,
  EmptyState,
  EmptyCatalogIcon,
  ConfirmModal,
} from '../components/common';
import { Modal, Input } from '../components/common';

export function PriceListCategoriesPage() {
  const { t, appLanguage } = useSettings();
  const { hasPermission } = useAuth();
  const { activePriceLists, defaultPriceList } = usePriceLists();

  const [selectedPriceListId, setSelectedPriceListId] = useState<string>(
    defaultPriceList?.priceListId || activePriceLists[0]?.priceListId || ''
  );
  const { categories, allCategories, createCategory, editCategory, deleteCategory } =
    usePriceListCategories(selectedPriceListId || undefined);

  const [showDeleted, setShowDeleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);

  const displayCategories = useMemo(() => {
    if (showDeleted) {
      const all = selectedPriceListId
        ? allCategories.filter((c) => c.priceListId === selectedPriceListId)
        : allCategories;
      return all.filter((c) => c.isDeleted);
    }
    return categories;
  }, [showDeleted, categories, allCategories, selectedPriceListId]);

  const deletedCategoryCount = useMemo(() => {
    const all = selectedPriceListId
      ? allCategories.filter((c) => c.priceListId === selectedPriceListId)
      : allCategories;
    return all.filter((c) => c.isDeleted).length;
  }, [allCategories, selectedPriceListId]);

  const handleRestore = (catalogCategoryId: string) => {
    editCategory(catalogCategoryId, { isDeleted: false });
    setRestoreConfirm(null);
  };

  const [formData, setFormData] = useState({
    priceListId: selectedPriceListId,
    catalogCategoryPrefix: '',
    catalogCategoryHu: '',
    catalogCategoryEn: '',
    catalogCategoryDe: '',
    isActive: true,
    isDeleted: false,
  });

  const openCreateModal = () => {
    setFormData({
      priceListId: selectedPriceListId,
      catalogCategoryPrefix: '',
      catalogCategoryHu: '',
      catalogCategoryEn: '',
      catalogCategoryDe: '',
      isActive: true,
      isDeleted: false,
    });
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: PriceListCategory) => {
    setFormData({
      priceListId: item.priceListId,
      catalogCategoryPrefix: item.catalogCategoryPrefix,
      catalogCategoryHu: item.catalogCategoryHu,
      catalogCategoryEn: item.catalogCategoryEn,
      catalogCategoryDe: item.catalogCategoryDe,
      isActive: item.isActive,
      isDeleted: item.isDeleted,
    });
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      editCategory(editingItem.catalogCategoryId, formData);
    } else {
      createCategory(formData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    deleteCategory(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.priceListCategory.title}</h1>
          <p className="text-gray-500 mt-1">
            {categories.length} {t.common.active}{deletedCategoryCount > 0 ? `, ${deletedCategoryCount} ${t.common.deleted}` : ''}
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
            {hasPermission('pricelist.category.restore') && (
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
          {!showDeleted && hasPermission('pricelist.category.create') && selectedPriceListId && (
            <Button onClick={openCreateModal}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.priceListCategory.newCategory}
            </Button>
          )}
        </div>
      </div>

      {/* Price List Selector */}
      <div className="flex items-center gap-4">
        <Select
          value={selectedPriceListId}
          onChange={(e) => setSelectedPriceListId(e.target.value)}
          options={[
            { value: '', label: t.priceList.selectPriceList },
            ...activePriceLists.map((pl) => ({
              value: pl.priceListId,
              label: getPriceListDisplayName(pl, appLanguage),
            })),
          ]}
          className="w-64"
        />
      </div>

      {!selectedPriceListId ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<EmptyCatalogIcon />}
              title={t.priceList.selectPriceList}
            />
          </CardContent>
        </Card>
      ) : displayCategories.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<EmptyCatalogIcon />}
              title={showDeleted ? t.priceListCategory.noDeletedItems : t.priceListCategory.noItems}
              actionLabel={!showDeleted && hasPermission('pricelist.category.create') ? t.priceListCategory.newCategory : undefined}
              onAction={!showDeleted && hasPermission('pricelist.category.create') ? openCreateModal : undefined}
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
                    <th className="pb-3 font-medium">{t.priceListCategory.prefix}</th>
                    <th className="pb-3 font-medium">{t.priceListCategory.nameHu}</th>
                    <th className="pb-3 font-medium">{t.priceListCategory.nameEn}</th>
                    <th className="pb-3 font-medium">{t.priceListCategory.nameDe}</th>
                    <th className="pb-3 font-medium text-center">{t.priceList.isActive}</th>
                    <th className="pb-3 font-medium text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayCategories.map((item) => (
                    <tr key={item.catalogCategoryId} className="border-b last:border-0">
                      <td className="py-3 font-mono text-sm font-medium">{item.catalogCategoryPrefix}</td>
                      <td className="py-3">{item.catalogCategoryHu}</td>
                      <td className="py-3 text-gray-600">{item.catalogCategoryEn}</td>
                      <td className="py-3 text-gray-600">{item.catalogCategoryDe}</td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.isActive ? t.common.active : t.common.inactive}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {showDeleted ? (
                            <button
                              onClick={() => setRestoreConfirm(item.catalogCategoryId)}
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
                              {hasPermission('pricelist.category.delete') && (
                                <button
                                  onClick={() => setDeleteConfirm(item.catalogCategoryId)}
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
        title={editingItem ? t.priceListCategory.editCategory : t.priceListCategory.newCategory}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t.priceListCategory.prefix}
            value={formData.catalogCategoryPrefix}
            onChange={(e) => setFormData({ ...formData, catalogCategoryPrefix: e.target.value.toUpperCase() })}
            required
            placeholder="DIAG"
          />
          <Input
            label={t.priceListCategory.nameHu}
            value={formData.catalogCategoryHu}
            onChange={(e) => setFormData({ ...formData, catalogCategoryHu: e.target.value })}
            required
          />
          <Input
            label={t.priceListCategory.nameEn}
            value={formData.catalogCategoryEn}
            onChange={(e) => setFormData({ ...formData, catalogCategoryEn: e.target.value })}
          />
          <Input
            label={t.priceListCategory.nameDe}
            value={formData.catalogCategoryDe}
            onChange={(e) => setFormData({ ...formData, catalogCategoryDe: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-dental-600 rounded focus:ring-dental-500"
            />
            {t.priceList.isActive}
          </label>
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
        message={t.priceListCategory.deleteConfirm}
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
        message={t.priceListCategory.restoreConfirm}
        confirmText={t.common.restore}
        cancelText={t.common.cancel}
      />
    </div>
  );
}
