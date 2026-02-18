import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

interface NavChild {
  to: string;
  label: string;
  permission?: string;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t, appLanguage, setAppLanguage } = useSettings();
  const { user, logout, hasPermission } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const location = useLocation();

  const toggleSubmenu = (key: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isAdmin = user?.role === 'admin';

  const allNavItems: Array<{ key: string; to: string; label: string; permission?: string; icon: React.ReactNode; children?: NavChild[] }> = [
    {
      key: 'dashboard',
      to: '/',
      label: t.nav.dashboard,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      key: 'patients',
      to: '/patients',
      label: t.nav.patients,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      children: [
        { to: '/patients', label: t.nav.patientsActive },
        ...(isAdmin ? [{ to: '/patients/deleted', label: t.nav.patientsDeleted }] : []),
      ],
    },
    {
      key: 'quotes',
      to: '/quotes',
      label: t.nav.quotes,
      permission: 'quotes.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      children: [
        { to: '/quotes', label: t.nav.quotesActive },
        ...(isAdmin ? [{ to: '/quotes/deleted', label: t.nav.quotesDeleted }] : []),
      ],
    },
    {
      key: 'invoices',
      to: '/invoices',
      label: t.nav.invoices,
      permission: 'invoices.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      key: 'catalog',
      to: '/catalog',
      label: t.nav.catalog,
      permission: 'catalog.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
      children: [
        { to: '/catalog/lists', label: t.nav.catalogLists, permission: 'pricelist.view' },
        { to: '/catalog/categories', label: t.nav.catalogCategories, permission: 'pricelist.view' },
        { to: '/catalog/items', label: t.nav.catalogItems },
      ],
    },
    {
      key: 'settings',
      to: '/settings',
      label: t.nav.settings,
      permission: 'settings.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      key: 'data',
      to: '/data',
      label: t.nav.dataManagement,
      permission: 'data.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      ),
    },
    {
      key: 'lab',
      to: '/odontogram-lab',
      label: t.nav.lab,
      permission: 'lab.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3h6m-6 0a2 2 0 00-2 2v2a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2m-6 0v2m6-2v2M7 11h10m-9 4h8m-7 4h6"
          />
        </svg>
      ),
    },
  ];

  if (hasPermission('admin.users.manage') || hasPermission('admin.permissions.manage')) {
    allNavItems.push({
      key: 'admin',
      to: '/admin',
      label: t.nav.admin,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055a12.083 12.083 0 01-6.16-9.477L12 14z"
          />
        </svg>
      ),
    });
  }

  const navItems = allNavItems.filter((item) => !item.permission || hasPermission(item.permission));

  const languageLabel = appLanguage === 'hu'
    ? t.settings.hungarian
    : appLanguage === 'en'
      ? t.settings.english
      : t.settings.german;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}
      >
        {/* Logo + logged-in user */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-dental-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C9.5 2 7.5 3.5 7 6c-.5 2.5-1 5-2 7-1 2-1.5 4-1 6 .5 2 2 3 3.5 3s2.5-1 3-2.5c.3-.9.5-2 .5-3.5 0 1.5.2 2.6.5 3.5.5 1.5 1.5 2.5 3 2.5s3-1 3.5-3c.5-2 0-4-1-6-1-2-1.5-4.5-2-7-.5-2.5-2.5-4-5-4z" />
                </svg>
                <span className="font-semibold text-gray-800">DentalQuote</span>
              </div>
              {user && (
                <p className="text-xs text-gray-500 truncate pl-10">{user.email}</p>
              )}
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isSidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const hasChildren = item.children && item.children.length > 1;
              const isExpanded = openMenus.has(item.key);
              const isParentActive = item.to !== '/' && location.pathname.startsWith(item.to);

              if (hasChildren && isSidebarOpen) {
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => toggleSubmenu(item.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isParentActive
                          ? 'bg-dental-100 text-dental-700 font-medium'
                          : 'text-gray-700 hover:bg-dental-50 hover:text-dental-700'
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1 text-left">{item.label}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <ul className="mt-1 space-y-1">
                        {item.children!.filter(c => !c.permission || hasPermission(c.permission)).map((child) => (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              end
                              className={({ isActive }) =>
                                `flex items-center pl-12 pr-4 py-2 rounded-lg text-sm transition-colors ${
                                  isActive
                                    ? 'bg-dental-100 text-dental-700 font-medium'
                                    : 'text-gray-600 hover:bg-dental-50 hover:text-dental-700'
                                }`
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive || (item.to !== '/' && location.pathname.startsWith(item.to))
                          ? 'bg-dental-100 text-dental-700 font-medium'
                          : 'text-gray-700 hover:bg-dental-50 hover:text-dental-700'
                      }`
                    }
                    title={!isSidebarOpen ? item.label : undefined}
                  >
                    {item.icon}
                    {isSidebarOpen && <span>{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Language Toggle */}
        <div className="p-4 border-t border-gray-200">
          <div className="w-full">
            <label className="sr-only" htmlFor="app-language-selector">
              {t.settings.language}
            </label>
            <select
              id="app-language-selector"
              value={appLanguage}
              onChange={(event) => setAppLanguage(event.target.value as 'hu' | 'en' | 'de')}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-dental-500"
              title={!isSidebarOpen ? languageLabel : undefined}
            >
              <option value="hu">{t.settings.hungarian}</option>
              <option value="en">{t.settings.english}</option>
              <option value="de">{t.settings.german}</option>
            </select>
          </div>
          {!isSidebarOpen && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
          )}
          <button
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            {isSidebarOpen ? t.login.logout : t.login.logoutShort}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
