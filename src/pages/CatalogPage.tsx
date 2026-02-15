import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../hooks';
import {
  CatalogItem,
  CatalogItemFormData,
  CatalogCategory,
  CatalogUnit,
  CATALOG_CATEGORIES,
  CATALOG_UNITS,
} from '../types';
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

const CATEGORY_CODE_PREFIX: Record<CatalogCategory, string> = {
  Diagnosztika: 'DIAG',
  Parodontológia: 'PARO',
  Konzerváló: 'KONZ',
  Endodoncia: 'ENDO',
  Szájsebészet: 'SZAJ',
  Implantáció: 'IMPL',
  Protetika: 'PROT',
  Gyerefogászat: 'GYER',
  Fogszabályozás: 'SZAB',
};

export function CatalogPage() {
  const { t } = useSettings();
  const { hasPermission } = useAuth();
  const {
    catalog,
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
  const [inlineItems, setInlineItems] = useState<Partial<Record<CatalogCategory, CatalogItemFormData>>>(
    {}
  );

  type CatalogSortColumn = 'catalogCode' | 'catalogName' | 'catalogUnit' | 'catalogPrice' | 'catalogTechnicalPrice';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<CatalogSortColumn>('catalogCode');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: CatalogSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortArrow = ({ column }: { column: CatalogSortColumn }) => (
    <span className="ml-1 inline-block w-3">
      {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </span>
  );

  const ThSortable = ({ column, children, align }: { column: CatalogSortColumn; children: React.ReactNode; align?: string }) => (
    <th
      className={`pb-3 font-medium cursor-pointer hover:text-gray-700 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(column)}
    >
      {children}
      <SortArrow column={column} />
    </th>
  );

  const IconBtn = ({ onClick, title, className, children }: { onClick: () => void; title: string; className: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${className}`}
    >
      {children}
    </button>
  );

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
    // Sort within each category
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        let cmp = 0;
        switch (sortColumn) {
          case 'catalogCode': cmp = a.catalogCode.localeCompare(b.catalogCode); break;
          case 'catalogName': cmp = a.catalogName.localeCompare(b.catalogName); break;
          case 'catalogUnit': cmp = a.catalogUnit.localeCompare(b.catalogUnit); break;
          case 'catalogPrice': cmp = a.catalogPrice - b.catalogPrice; break;
          case 'catalogTechnicalPrice': cmp = (a.catalogTechnicalPrice ?? 0) - (b.catalogTechnicalPrice ?? 0); break;
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return groups;
  }, [filteredItems, sortColumn, sortDirection]);

  const getNextCatalogCode = (category: CatalogCategory, items: CatalogItem[] = []) => {
    const prefix = CATEGORY_CODE_PREFIX[category] || category.slice(0, 4).toUpperCase();
    let maxNumber = 0;
    items.forEach((item) => {
      const match = item.catalogCode.match(/(\d+)$/);
      if (match) {
        const value = parseInt(match[1], 10);
        if (value > maxNumber) {
          maxNumber = value;
        }
      }
    });
    const nextNumber = maxNumber + 1;
    return `${prefix}${String(nextNumber).padStart(2, '0')}`;
  };

  const startInlineItem = (category: CatalogCategory) => {
    setInlineItems((prev) => {
      if (prev[category]) return prev;
      const itemsForCategory = catalog.filter((item) => item.catalogCategory === category);
      const nextCode = getNextCatalogCode(category, itemsForCategory);
      return {
        ...prev,
        [category]: {
          catalogCode: nextCode,
          catalogName: '',
          catalogNameEn: '',
          catalogNameDe: '',
          catalogUnit: 'alkalom',
          catalogPrice: 0,
          catalogPriceCurrency: 'HUF',
          catalogVatRate: 0,
          catalogTechnicalPrice: 0,
          catalogCategory: category,
          hasTechnicalPrice: false,
          isFullMouth: false,
          isArch: false,
          isQuadrant: false,
          maxTeethPerArch: undefined,
          allowedTeeth: undefined,
          milkToothOnly: false,
          isActive: true,
        },
      };
    });
  };

  const updateInlineItem = (category: CatalogCategory, updates: Partial<CatalogItemFormData>) => {
    setInlineItems((prev) => {
      const item = prev[category];
      if (!item) return prev;
      const nextItem: CatalogItemFormData = {
        ...item,
        ...updates,
      };

      if (updates.catalogTechnicalPrice !== undefined) {
        const technicalPrice = Number(updates.catalogTechnicalPrice) || 0;
        nextItem.catalogTechnicalPrice = technicalPrice;
        nextItem.hasTechnicalPrice = technicalPrice > 0;
      }

      return {
        ...prev,
        [category]: nextItem,
      };
    });
  };

  const cancelInlineItem = (category: CatalogCategory) => {
    setInlineItems((prev) => {
      const updated = { ...prev };
      delete updated[category];
      return updated;
    });
  };

  const saveInlineItem = (category: CatalogCategory) => {
    const item = inlineItems[category];
    if (!item) return;

    if (!item.catalogName.trim() || !item.catalogUnit.trim()) {
      return;
    }

    createCatalogItem(item);
    cancelInlineItem(category);
  };

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
          {hasPermission('catalog.update') && hasPermission('catalog.delete') && (
          <Button variant="secondary" onClick={() => setResetConfirm(true)}>
            {t.catalog.resetToDefault}
          </Button>
          )}
          {hasPermission('catalog.create') && (
          <Button onClick={() => setIsModalOpen(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.catalog.newItem}
          </Button>
          )}
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
          {Object.entries(groupedItems).map(([category, items]) => {
            const catalogCategory = category as CatalogCategory;
            const inlineItem = inlineItems[catalogCategory];
            const isInlineValid = inlineItem
              ? inlineItem.catalogName.trim().length > 0 &&
                inlineItem.catalogUnit.trim().length > 0 &&
                inlineItem.catalogPrice >= 0 &&
                inlineItem.catalogTechnicalPrice >= 0
              : false;

            return (
              <Card key={category}>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
                    {hasPermission('catalog.create') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startInlineItem(catalogCategory)}
                      disabled={Boolean(inlineItem)}
                    >
                      {t.common.add}
                    </Button>
                    )}
                  </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <ThSortable column="catalogCode">{t.catalog.code}</ThSortable>
                        <ThSortable column="catalogName">{t.catalog.name}</ThSortable>
                        <ThSortable column="catalogUnit">{t.catalog.unit}</ThSortable>
                        <ThSortable column="catalogPrice" align="right">{t.catalog.price}</ThSortable>
                        <ThSortable column="catalogTechnicalPrice" align="right">{t.catalog.technicalPrice}</ThSortable>
                        <th className="pb-3 font-medium text-center">SVG</th>
                        <th className="pb-3 font-medium text-center">{t.catalog.applicability}</th>
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
                          <td className="py-3 text-right font-medium">
                            {item.hasTechnicalPrice ? formatCurrency(item.catalogTechnicalPrice) : '-'}
                          </td>
                          <td className="py-3 text-center">
                            {item.svgLayer ? (
                              <svg className="w-4 h-4 text-green-500 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            {item.isFullMouth ? (
                              <span title={t.catalog.fullMouth}>
                                <svg className="w-5 h-5 inline-block" viewBox="0 0 58 30" fill="none">
                                  <path d="M6.5,11.4c-.2-.3,0-.8.4-1.2,0,0,.1-.1.2-.2,1.6-1.6,4.2-2.5,6.4-3.2,2.7-.8,5.7-1.6,8.5-1.4,3,0,5.8,1.6,8.8,1.6,1.7,0,3.4-.6,5.1-1,1.6-.4,3.3-.5,5.1-.4,3.7.3,7.5,1.3,10.8,3,.6.3,1.1.6,1.6,1,.8.5,2.5,1.9,1.7,2.6-1,.6-3,.5-4.8.5-1.9,0-3.9-.2-5.8-.3-5.1-.3-10-.5-15.1-.7-2.5,0-4.9-.1-7.3,0-1.7,0-3.2.5-4.9.7-1.5.2-3,.2-4.5.2-1.4,0-5.5,0-6.1-1.1h0Z" fill="#ff317b"/>
                                  <path d="M51.3,22.9c-1.3,1.8-7.4,5.4-10,6.1-1.2.3-2.4.3-3.7.1-2.2-.3-4.4-.8-6.6-.9-1.4,0-2.3.4-3.8.5-1.3,0-3.1.4-4.4.5-1.3,0-2.7-.3-3.9-.6-3.9-1.1-9-6.8-12.1-10.4-2.3-2.9-1.4-3.1,1.5-1.5,2.3,1.3,4.7,2.8,7,4,1,.5,2,.9,3.2,1.1.5,0,1.1.2,1.7.2,3.8.4,7.6,1.3,11.4,1.5,1.7,0,3.4-.3,5.1-.7,2.5-.6,5-1.4,7.5-2,.8-.2,1.5-.5,2.2-.9,2.2-1.1,4.6-2.8,6.9-4,.6-.3,2.4-1.2,2.1,0-.1.5-.5,1-.8,1.5-1.1,1.8-2.2,3.8-3.4,5.5h0Z" fill="#ff317b"/>
                                </svg>
                              </span>
                            ) : item.isArch ? (
                              <span title={t.catalog.arch}>
                                <svg className="w-5 h-5 inline-block" viewBox="0 0 58 56" fill="none">
                                  <path d="M5.9,31.3c.2-5.2,0-10.1,1.9-14.9,2.4-5.6,9.2-11.1,16.2-12.1,7.4-.9,17.3-1.3,22.7,3.9,7.3,7.8,6.8,21.9,6.5,32.2-.3,4.1-1,7.9-2,9-1.3,1.4-2.2-.7-3.1-4-1.3-5.3-2.5-18.5-5.3-23.3-3.5-6.4-15.3-7.9-22-4.8-6.4,2.8-6.6,14.1-7,20.9s0,11.4-3.1,13.5c-2.3,1.3-4.9-6.3-5.3-9.1" fill="#0051bf"/>
                                </svg>
                              </span>
                            ) : item.isQuadrant ? (
                              <span title={t.catalog.quadrant}>
                                <svg className="w-4 h-4 text-orange-500 inline-block" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="3" y="3" width="8" height="8" rx="1" />
                                  <rect x="13" y="3" width="8" height="8" rx="1" opacity="0.2" />
                                  <rect x="3" y="13" width="8" height="8" rx="1" opacity="0.2" />
                                  <rect x="13" y="13" width="8" height="8" rx="1" opacity="0.2" />
                                </svg>
                              </span>
                            ) : (
                              <span title={t.catalog.toothItem}>
                                <svg className="w-5 h-5 inline-block" viewBox="0 0 42 64" fill="none">
                                  <path d="M13.6,17.2c.3,1.9.9,4.3,2.6,5.3,1.5.9,2.9-.4,3.4-1.8,1.7-4.8.3-10.7,2.2-15.5.8-1.7,2.6-1.5,3.4.2,1,1.9,1.1,4.3,1.4,6.5.3,3.8-.7,7.3-1.6,11-1,4-1.2,8.3,0,12.4,1.8,8,7.5,21.1-2,24.4-1.4.2-2.9-.5-4.5-.9-3-1-5.1,1-8,1.5-8.9,1.4-6.7-14.5-4.9-19.4.9-2.3,1.9-4.7,2.1-7.3.3-5.2-1.1-10.8-.8-15.9,0-3.3.5-6.8,1.2-10.1.2-1.7,2.2-5.9,3.9-3.2,1.4,3.9.9,8.8,1.6,12.6,0,0,0,.2,0,.2Z" fill="#ebebeb" stroke="#0051bf" strokeMiterlimit={10}/>
                                </svg>
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {hasPermission('catalog.update') && (
                                <IconBtn onClick={() => setEditingItem(item)} title={t.common.edit} className="text-gray-600 hover:bg-gray-100">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </IconBtn>
                              )}
                              {hasPermission('catalog.update') && (
                                <IconBtn onClick={() => toggleItemActive(item.catalogItemId)} title={item.isActive ? 'Deaktiválás' : 'Aktiválás'} className="text-red-600 hover:bg-red-50">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </IconBtn>
                              )}
                              {hasPermission('catalog.delete') && (
                                <IconBtn onClick={() => setDeleteConfirm(item.catalogItemId)} title={t.common.delete} className="text-red-500 hover:bg-red-50">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </IconBtn>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {inlineItem && (
                        <tr className="border-b last:border-0 bg-gray-50">
                          <td className="py-3 font-mono text-sm">{inlineItem.catalogCode}</td>
                          <td className="py-3">
                            <input
                              type="text"
                              value={inlineItem.catalogName}
                              onChange={(e) =>
                                updateInlineItem(catalogCategory, { catalogName: e.target.value })
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-dental-500 focus:ring-dental-500"
                              placeholder="Megnevezés"
                            />
                          </td>
                          <td className="py-3">
                            <select
                              value={inlineItem.catalogUnit}
                              onChange={(e) =>
                                updateInlineItem(catalogCategory, {
                                  catalogUnit: e.target.value as CatalogItemFormData['catalogUnit'],
                                })
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-dental-500 focus:ring-dental-500"
                            >
                              {CATALOG_UNITS.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={inlineItem.catalogPrice}
                              onChange={(e) =>
                                updateInlineItem(catalogCategory, {
                                  catalogPrice: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-dental-500 focus:ring-dental-500"
                              placeholder="Ár"
                            />
                          </td>
                          <td className="py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={inlineItem.catalogTechnicalPrice}
                              onChange={(e) =>
                                updateInlineItem(catalogCategory, {
                                  catalogTechnicalPrice: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-dental-500 focus:ring-dental-500"
                              placeholder={t.catalog.technicalPrice}
                            />
                          </td>
                          <td className="py-3 text-center"><span className="text-gray-300">-</span></td>
                          <td className="py-3 text-center"><span className="text-gray-300">-</span></td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                disabled={!isInlineValid}
                                onClick={() => saveInlineItem(catalogCategory)}
                              >
                                Rögzítés
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => cancelInlineItem(catalogCategory)}
                              >
                                Törlés
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
              </Card>
            );
          })}
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
        existingCodes={catalog.map((c) => c.catalogCode)}
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
  existingCodes?: string[];
}

function CatalogItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  item,
  title,
  existingCodes,
}: CatalogItemFormModalProps) {
  const { t } = useSettings();
  const formatGroupedNumber = (value: number): string => {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    return normalized.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const parseGroupedNumber = (value: string): number => {
    const digits = value.replace(/\s+/g, '').replace(/[^\d]/g, '');
    if (!digits) return 0;
    return Number(digits);
  };

  const [formData, setFormData] = useState<CatalogItemFormData>({
    catalogCode: item?.catalogCode || '',
    catalogName: item?.catalogName || '',
    catalogNameEn: item?.catalogNameEn || '',
    catalogNameDe: item?.catalogNameDe || '',
    catalogUnit: item?.catalogUnit || 'alkalom',
    catalogPrice: item?.catalogPrice ?? 10000,
    catalogPriceCurrency: item?.catalogPriceCurrency || 'HUF',
    catalogVatRate: item?.catalogVatRate || 0,
    catalogTechnicalPrice: item?.catalogTechnicalPrice || 0,
    catalogCategory: item?.catalogCategory || 'Diagnosztika',
    svgLayer: item?.svgLayer || '',
    hasLayer: item?.hasLayer ?? false,
    hasTechnicalPrice:
      item?.catalogTechnicalPrice !== undefined
        ? (item.catalogTechnicalPrice ?? 0) > 0
        : item?.hasTechnicalPrice ?? false,
    isFullMouth: item?.isFullMouth ?? false,
    isArch: item?.isArch ?? false,
    isQuadrant: item?.isQuadrant ?? false,
    maxTeethPerArch: item?.maxTeethPerArch,
    allowedTeeth: item?.allowedTeeth,
    milkToothOnly: item?.milkToothOnly ?? false,
    isActive: item?.isActive ?? true,
  });
  const [catalogPriceInput, setCatalogPriceInput] = useState<string>(
    formatGroupedNumber(item?.catalogPrice ?? 10000)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const nextPrice = item?.catalogPrice ?? 10000;
    setFormData({
      catalogCode: item?.catalogCode || '',
      catalogName: item?.catalogName || '',
      catalogNameEn: item?.catalogNameEn || '',
      catalogNameDe: item?.catalogNameDe || '',
      catalogUnit: item?.catalogUnit || 'alkalom',
      catalogPrice: nextPrice,
      catalogPriceCurrency: item?.catalogPriceCurrency || 'HUF',
      catalogVatRate: item?.catalogVatRate || 0,
      catalogTechnicalPrice: item?.catalogTechnicalPrice || 0,
      catalogCategory: item?.catalogCategory || 'Diagnosztika',
      svgLayer: item?.svgLayer || '',
      hasLayer: item?.hasLayer ?? false,
      hasTechnicalPrice:
        item?.catalogTechnicalPrice !== undefined
          ? (item.catalogTechnicalPrice ?? 0) > 0
          : item?.hasTechnicalPrice ?? false,
      isFullMouth: item?.isFullMouth ?? false,
      isArch: item?.isArch ?? false,
      isQuadrant: item?.isQuadrant ?? false,
      maxTeethPerArch: item?.maxTeethPerArch,
      allowedTeeth: item?.allowedTeeth,
      milkToothOnly: item?.milkToothOnly ?? false,
      isActive: item?.isActive ?? true,
    });
    setCatalogPriceInput(formatGroupedNumber(nextPrice));
    setErrors({});
  }, [isOpen, item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.catalogCode.trim()) newErrors.catalogCode = t.validation.required;
    if (!formData.catalogName.trim()) newErrors.catalogName = t.validation.required;
    if (!formData.catalogUnit.trim()) newErrors.catalogUnit = t.validation.required;
    if (formData.catalogPrice < 0) newErrors.catalogPrice = t.catalog.priceNegative;
    if (formData.catalogTechnicalPrice < 0)
      newErrors.catalogTechnicalPrice = t.catalog.technicalPriceNegative;
    if (existingCodes && formData.catalogCode.trim()) {
      const isDuplicate = existingCodes.some(
        (code) => code.toUpperCase() === formData.catalogCode.toUpperCase()
      );
      const originalCode = item?.catalogCode?.toUpperCase();
      if (isDuplicate && formData.catalogCode.toUpperCase() !== originalCode) {
        newErrors.catalogCode = t.catalog.codeDuplicate;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      ...formData,
      hasTechnicalPrice: formData.catalogTechnicalPrice > 0,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.catalog.category}
            value={formData.catalogCategory}
            onChange={(e) =>
              setFormData({ ...formData, catalogCategory: e.target.value as CatalogCategory })
            }
            options={CATALOG_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            required
          />
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
        </div>

        <Input
          label={t.catalog.name}
          value={formData.catalogName}
          onChange={(e) => setFormData({ ...formData, catalogName: e.target.value })}
          error={errors.catalogName}
          required
          placeholder="pl. Konzultáció"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.catalog.nameEn}
            value={formData.catalogNameEn || ''}
            onChange={(e) => setFormData({ ...formData, catalogNameEn: e.target.value })}
            placeholder="e.g. Consultation"
          />
          <Input
            label={t.catalog.nameDe}
            value={formData.catalogNameDe || ''}
            onChange={(e) => setFormData({ ...formData, catalogNameDe: e.target.value })}
            placeholder="z.B. Beratung"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.catalog.price}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={catalogPriceInput}
                  onChange={(e) => {
                    const parsed = parseGroupedNumber(e.target.value);
                    setCatalogPriceInput(formatGroupedNumber(parsed));
                    setFormData({ ...formData, catalogPrice: parsed });
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    const step = formData.catalogPriceCurrency === 'HUF' ? 1000 : 10;
                    const direction = e.key === 'ArrowUp' ? 1 : -1;
                    const next = Math.max(0, formData.catalogPrice + direction * step);
                    setCatalogPriceInput(formatGroupedNumber(next));
                    setFormData({ ...formData, catalogPrice: next });
                  }}
                  className="w-full px-3 py-2 pr-10 text-right tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                  required
                />
                <div className="absolute inset-y-0 right-1 flex flex-col justify-center gap-0.5">
                  <button
                    type="button"
                    className="h-4 w-6 rounded text-gray-500 hover:bg-gray-100"
                    onClick={() => {
                      const step = formData.catalogPriceCurrency === 'HUF' ? 1000 : 10;
                      const next = Math.max(0, formData.catalogPrice + step);
                      setCatalogPriceInput(formatGroupedNumber(next));
                      setFormData({ ...formData, catalogPrice: next });
                    }}
                    aria-label="Increase price"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="mx-auto h-3 w-3">
                      <path d="M5.25 11.25 10 6.5l4.75 4.75h-9.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="h-4 w-6 rounded text-gray-500 hover:bg-gray-100"
                    onClick={() => {
                      const step = formData.catalogPriceCurrency === 'HUF' ? 1000 : 10;
                      const next = Math.max(0, formData.catalogPrice - step);
                      setCatalogPriceInput(formatGroupedNumber(next));
                      setFormData({ ...formData, catalogPrice: next });
                    }}
                    aria-label="Decrease price"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="mx-auto h-3 w-3">
                      <path d="m5.25 8.75 4.75 4.75 4.75-4.75h-9.5Z" />
                    </svg>
                  </button>
                </div>
              </div>
              {errors.catalogPrice && <p className="mt-1 text-sm text-red-600">{errors.catalogPrice}</p>}
            </div>
          </div>
          <div className="md:col-span-3">
            <Select
              label={t.catalog.currency}
              value={formData.catalogPriceCurrency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  catalogPriceCurrency: e.target.value as 'HUF' | 'EUR',
                })
              }
              style={{ minWidth: 0 }}
              options={[
                { value: 'HUF', label: 'HUF' },
                { value: 'EUR', label: 'EUR' },
              ]}
            />
          </div>
          <div className="md:col-span-4">
            <Select
              label={t.catalog.unit}
              value={formData.catalogUnit}
              onChange={(e) =>
                setFormData({ ...formData, catalogUnit: e.target.value as CatalogUnit })
              }
              style={{ minWidth: 0 }}
              options={CATALOG_UNITS.map((unit) => ({ value: unit, label: unit }))}
              error={errors.catalogUnit}
              required
            />
          </div>
        </div>

        <Input
          label={t.catalog.technicalPrice}
          type="number"
          value={formData.catalogTechnicalPrice}
          onChange={(e) => {
            const value = parseFloat(e.target.value) || 0;
            setFormData({
              ...formData,
              catalogTechnicalPrice: value,
              hasTechnicalPrice: value > 0,
            });
          }}
          error={errors.catalogTechnicalPrice}
          min={0}
          placeholder="0"
        />

        <Input
          label={t.catalog.svgLayers}
          type="text"
          value={formData.svgLayer}
          onChange={(e) => setFormData({ ...formData, svgLayer: e.target.value, hasLayer: e.target.value.trim().length > 0 })}
          placeholder="filling-composite-[surfaces4]"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.catalog.applicability}
          </label>
          <div className="flex flex-wrap gap-4">
            {[
              { value: 'fullMouth', label: t.catalog.fullMouth },
              { value: 'arch', label: t.catalog.arch },
              { value: 'quadrant', label: t.catalog.quadrant },
              { value: 'tooth', label: t.catalog.toothItem },
            ].map((opt) => {
              const currentValue = formData.isFullMouth ? 'fullMouth'
                : formData.isArch ? 'arch'
                : formData.isQuadrant ? 'quadrant'
                : 'tooth';
              return (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="applicability"
                    checked={currentValue === opt.value}
                    onChange={() => setFormData({
                      ...formData,
                      isFullMouth: opt.value === 'fullMouth',
                      isArch: opt.value === 'arch',
                      isQuadrant: opt.value === 'quadrant',
                    })}
                    className="w-4 h-4 text-dental-600 focus:ring-dental-500"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {formData.isArch && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.catalog.maxTeethPerArch ?? 'Max fog / állcsont'}
            </label>
            <input
              type="number"
              value={formData.maxTeethPerArch ?? ''}
              onChange={(e) => setFormData({ ...formData, maxTeethPerArch: e.target.value ? Number(e.target.value) : undefined })}
              min={1}
              max={14}
              placeholder="—"
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.catalog.restrictions ?? 'Korlátozás'}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.milkToothOnly ?? false}
              onChange={(e) => setFormData({ ...formData, milkToothOnly: e.target.checked })}
              className="w-4 h-4 text-dental-600 rounded focus:ring-dental-500"
            />
            {t.catalog.milkToothOnly ?? 'Csak tejfogra'}
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.catalog.allowedTeeth ?? 'Engedélyezett fogak'}
          </label>
          <input
            type="text"
            value={formData.allowedTeeth?.join(', ') ?? ''}
            onChange={(e) => {
              const text = e.target.value.trim();
              if (!text) {
                setFormData({ ...formData, allowedTeeth: undefined });
              } else {
                const nums = text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
                setFormData({ ...formData, allowedTeeth: nums.length > 0 ? nums : undefined });
              }
            }}
            placeholder="14, 15, 24, 25, ..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500"
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
