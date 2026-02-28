import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { PageTabBar } from '../components/common';
import type { PageTab } from '../components/common/PageTabBar';

type CatalogSection = 'lists' | 'categories' | 'items';

export function CatalogLayout({ section, children }: { section?: CatalogSection; children?: ReactNode }) {
  const { t } = useSettings();

  const tabs: PageTab[] = [
    {
      key: 'overview',
      to: '/catalog',
      label: t.nav.catalogOverview,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      key: 'lists',
      to: '/catalog/lists',
      label: t.nav.catalogLists,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      key: 'categories',
      to: '/catalog/categories',
      label: t.nav.catalogCategories,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      key: 'items',
      to: '/catalog/items',
      label: t.nav.catalogItems,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
  ];

  const overviewCards: Array<{ key: CatalogSection; to: string; title: string; description: string; icon: React.ReactNode }> = [
    {
      key: 'lists',
      to: '/catalog/lists',
      title: t.priceList.title,
      description: t.catalog.overviewListsDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      key: 'categories',
      to: '/catalog/categories',
      title: t.priceListCategory.title,
      description: t.catalog.overviewCategoriesDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      key: 'items',
      to: '/catalog/items',
      title: t.catalog.title,
      description: t.catalog.overviewItemsDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.nav.catalog}</h1>
        <p className="text-gray-500 mt-1">{t.catalog.subtitle}</p>
      </div>

      <PageTabBar tabs={tabs} />

      {!section && (
        <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overviewCards.map((card) => (
            <Link
              key={card.key}
              to={card.to}
              className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-dental-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">{card.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {section && children}
    </div>
  );
}
