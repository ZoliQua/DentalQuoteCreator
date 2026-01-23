import { useState, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useCatalog } from '../hooks';
import { CatalogItem, CatalogItemFormData, CatalogCategory, CATALOG_CATEGORIES } from '../types';
import {
  Button,
  Card,
  CardContent,
  SearchInput,
  Modal,
  Input,
  Select,
  EmptyState,
  EmptyCatalogIcon,
  ConfirmModal,
} from '../components/common';
import { formatCurrency } from '../utils';

export function CatalogPage() {
  const { t } = useSettings();
  const {
    activeItems,
    inactiveItems,
    createCatalogItem,
    editCatalogItem,
    deleteCatalogItem,
    toggleItemActive,
    searchCatalog,
    resetCatalog,
  } = useCatalog();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const filteredItems = useMemo(() => {
    let items = searchCatalog(
      searchQuery,
      selectedCategory === 'all' ? undefined : selectedCategory,
      !showInactive
    );

    if (showInactive) {
      items = items.filter((item) => !item.isActive);
    }

    return items;
  }, [searchCatalog, searchQuery, selectedCategory, showInactive]);

  const handleCreateItem = (data: CatalogItemFormData) => {
    createCatalogItem(data);
    setIsModalOpen(false);
  };

  const handleEditItem = (data: CatalogItemFormData) => {
    if (editingItem) {
      editCatalogItem(editingItem.catalogItemId, data);
      setEditingItem(null);
    }
  };

  const handleDelete = (catalogItemId: string) => {
    deleteCatalogItem(catalogItemId);
    setDeleteConfirm(null);
  };

  const handleReset = () => {
    resetCatalog();
    setResetConfirm(false);
  };

  // Group items by category for display
  const groupedItems = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.catalogCategory;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.catalog.title}</h1>
          <p className="text-gray-500 mt-1">
            {activeItems.length} {t.common.active}, {inactiveItems.length} inaktív tétel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setResetConfirm(true)}>
            {t.catalog.resetToDefault}
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.catalog.newItem}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Keresés név vagy kód alapján..."
          className="flex-1 min-w-64"
        />
        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as CatalogCategory | 'all')}
          options={[
            { value: 'all', label: t.common.all },
            ...CATALOG_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
          ]}
          className="w-48"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !showInactive ? 'bg-dental-100 text-dental-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.common.active}
          </button>
          <button
            onClick={() => setShowInactive(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showInactive ? 'bg-dental-100 text-dental-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Inaktív
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<EmptyCatalogIcon />}
              title={t.catalog.noItems}
              description="Adja hozzá az első tételt az árlistához"
              actionLabel={t.catalog.newItem}
              onAction={() => setIsModalOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <Card key={category}>
              <CardContent>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{category}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 font-medium">{t.catalog.code}</th>
                        <th className="pb-3 font-medium">{t.catalog.name}</th>
                        <th className="pb-3 font-medium">{t.catalog.unit}</th>
                        <th className="pb-3 font-medium text-right">{t.catalog.price}</th>
                        <th className="pb-3 font-medium text-right">{t.common.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.catalogItemId} className="border-b last:border-0">
                          <td className="py-3 font-mono text-sm">{item.catalogCode}</td>
                          <td className="py-3">
                            <span className={!item.isActive ? 'text-gray-400 line-through' : ''}>
                              {item.catalogName}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500">{item.catalogUnit}</td>
                          <td className="py-3 text-right font-medium">
                            {formatCurrency(item.catalogPrice)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingItem(item)}
                              >
                                {t.common.edit}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleItemActive(item.catalogItemId)}
                              >
                                {item.isActive ? 'Deaktiválás' : 'Aktiválás'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirm(item.catalogItemId)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {t.common.delete}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CatalogItemFormModal
        isOpen={isModalOpen || editingItem !== null}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={editingItem ? handleEditItem : handleCreateItem}
        item={editingItem || undefined}
        title={editingItem ? t.catalog.editItem : t.catalog.newItem}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title={t.common.confirm}
        message={t.catalog.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Reset Confirmation */}
      <ConfirmModal
        isOpen={resetConfirm}
        onClose={() => setResetConfirm(false)}
        onConfirm={handleReset}
        title={t.common.confirm}
        message={t.catalog.resetConfirm}
        confirmText={t.catalog.resetToDefault}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}

interface CatalogItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CatalogItemFormData) => void;
  item?: CatalogItem;
  title: string;
}

function CatalogItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  item,
  title,
}: CatalogItemFormModalProps) {
  const { t } = useSettings();
  const [formData, setFormData] = useState<CatalogItemFormData>({
    catalogCode: item?.catalogCode || '',
    catalogName: item?.catalogName || '',
    catalogUnit: item?.catalogUnit || 'alkalom',
    catalogPrice: item?.catalogPrice || 0,
    catalogPriceCurrency: item?.catalogPriceCurrency || 'HUF',
    catalogVatRate: item?.catalogVatRate || 0,
    catalogCategory: item?.catalogCategory || 'Egyéb',
    isActive: item?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.catalogCode.trim()) newErrors.catalogCode = t.validation.required;
    if (!formData.catalogName.trim()) newErrors.catalogName = t.validation.required;
    if (!formData.catalogUnit.trim()) newErrors.catalogUnit = t.validation.required;
    if (formData.catalogPrice < 0) newErrors.catalogPrice = 'Az ár nem lehet negatív';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.catalog.code}
            value={formData.catalogCode}
            onChange={(e) =>
              setFormData({ ...formData, catalogCode: e.target.value.toUpperCase() })
            }
            error={errors.catalogCode}
            required
            placeholder="pl. KONZ01"
          />
          <Select
            label={t.catalog.category}
            value={formData.catalogCategory}
            onChange={(e) =>
              setFormData({ ...formData, catalogCategory: e.target.value as CatalogCategory })
            }
            options={CATALOG_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            required
          />
        </div>

        <Input
          label={t.catalog.name}
          value={formData.catalogName}
          onChange={(e) => setFormData({ ...formData, catalogName: e.target.value })}
          error={errors.catalogName}
          required
          placeholder="pl. Konzultáció"
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label={t.catalog.unit}
            value={formData.catalogUnit}
            onChange={(e) => setFormData({ ...formData, catalogUnit: e.target.value })}
            error={errors.catalogUnit}
            required
            placeholder="pl. alkalom, fog"
          />
          <Input
            label={t.catalog.price}
            type="number"
            value={formData.catalogPrice}
            onChange={(e) =>
              setFormData({ ...formData, catalogPrice: parseFloat(e.target.value) || 0 })
            }
            error={errors.catalogPrice}
            min={0}
            required
          />
          <Select
            label={t.catalog.currency}
            value={formData.catalogPriceCurrency}
            onChange={(e) =>
              setFormData({
                ...formData,
                catalogPriceCurrency: e.target.value as 'HUF' | 'EUR',
              })
            }
            options={[
              { value: 'HUF', label: 'HUF' },
              { value: 'EUR', label: 'EUR' },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-4 h-4 text-dental-600 rounded focus:ring-dental-500"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700">
            Aktív (megjelenik az árlistában)
          </label>
        </div>

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
