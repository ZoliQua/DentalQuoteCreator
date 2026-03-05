import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import dcqLogo from '../../assets/dcq_logo.svg';

interface NavChild {
  to: string;
  label: string;
  permission?: string;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t, appLanguage, setAppLanguage, theme, setTheme } = useSettings();
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
      key: 'calendar',
      to: '/calendar',
      label: t.nav.calendar,
      permission: 'calendar.view',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      children: [
        { to: '/calendar/day', label: t.nav.calendarDay },
        { to: '/calendar/week', label: t.nav.calendarWeek },
        { to: '/calendar/month', label: t.nav.calendarMonth },
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
      permission: 'pricelist.view',
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
        { to: '/catalog', label: t.nav.catalogOverview },
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
      children: [
        { to: '/settings', label: t.nav.settingsOverview },
        { to: '/settings/general', label: t.nav.settingsGeneral },
        { to: '/settings/clinic', label: t.nav.settingsClinic },
        { to: '/settings/patient', label: t.nav.settingsPatient },
        { to: '/settings/calendar', label: t.nav.settingsCalendar },
        { to: '/settings/quotes', label: t.nav.settingsQuotes },
        { to: '/settings/invoicing', label: t.nav.settingsInvoicing },
        { to: '/settings/neak', label: t.nav.settingsNeak },
      ],
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
      children: [
        { to: '/data', label: t.nav.dataOverview },
        { to: '/data/pricelist', label: t.nav.dataPricelist },
        { to: '/data/patients', label: t.nav.dataPatients },
        { to: '/data/storage', label: t.nav.dataStorage },
        { to: '/data/database', label: t.nav.dataDatabase },
        { to: '/data/usage', label: t.nav.dataUsage },
        { to: '/data/browser', label: t.nav.dataBrowser, permission: 'data.browse' },
      ],
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
      children: [
        { to: '/odontogram-lab', label: t.nav.labOdontogram },
        { to: '/importer', label: t.nav.labImporter },
      ],
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

  return (
    <div className="min-h-screen bg-theme-primary flex">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-theme-sidebar border-r border-theme-primary flex flex-col transition-all duration-300`}
      >
        {/* Logo + logged-in user */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-theme-primary">
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <img src={dcqLogo} alt="DentalQuoter" className="w-12 h-12 flex-shrink-0" />
                <span className="font-semibold text-theme-primary">DentalQuoter</span>
              </div>
              {user && (
                <p className="text-xs text-theme-tertiary truncate pl-10">{user.email}</p>
              )}
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg text-theme-tertiary hover:bg-theme-hover flex-shrink-0"
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
                          ? 'bg-theme-sidebar-active text-dental-700 dark:text-dental-300 font-medium'
                          : 'text-theme-secondary hover:bg-theme-sidebar-hover hover:text-dental-700 dark:hover:text-dental-300'
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
                        {item.children!.filter(c => !c.permission || hasPermission(c.permission)).map((child) => {
                          const isChildActive = location.pathname === child.to;
                          return (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              className={() =>
                                `flex items-center pl-12 pr-4 py-2 rounded-lg text-sm transition-colors ${
                                  isChildActive
                                    ? 'bg-theme-sidebar-active text-dental-700 dark:text-dental-300 font-medium'
                                    : 'text-theme-secondary hover:bg-theme-sidebar-hover hover:text-dental-700 dark:hover:text-dental-300'
                                }`
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                          );
                        })}
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
                          ? 'bg-theme-sidebar-active text-dental-700 dark:text-dental-300 font-medium'
                          : 'text-theme-secondary hover:bg-theme-sidebar-hover hover:text-dental-700 dark:hover:text-dental-300'
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

        {/* Language + Theme Toggle + Logout */}
        <div className="p-4 border-t border-theme-primary">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <select
                id="app-language-selector"
                value={appLanguage}
                onChange={(event) => setAppLanguage(event.target.value as 'hu' | 'en' | 'de')}
                className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-theme-secondary bg-theme-input text-sm text-theme-secondary focus:outline-none focus:ring-2 focus:ring-dental-500"
              >
                <option value="hu">🇭🇺 Magyar</option>
                <option value="en">🇬🇧 English</option>
                <option value="de">🇩🇪 Deutsch</option>
              </select>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-theme-secondary text-theme-secondary hover:bg-theme-hover transition-colors"
                title={theme === 'dark' ? t.settings.themeLight : t.settings.themeDark}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {([['hu', '🇭🇺'], ['en', '🇬🇧'], ['de', '🇩🇪']] as const).map(([lang, flag]) => (
                <button
                  key={lang}
                  onClick={() => setAppLanguage(lang)}
                  className={`w-10 h-8 rounded-md text-lg leading-none transition-colors ${
                    appLanguage === lang
                      ? 'bg-dental-100 ring-2 ring-dental-500'
                      : 'hover:bg-theme-hover'
                  }`}
                  title={lang === 'hu' ? t.settings.hungarian : lang === 'en' ? t.settings.english : t.settings.german}
                >
                  {flag}
                </button>
              ))}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-10 h-8 flex items-center justify-center rounded-md text-theme-secondary hover:bg-theme-hover transition-colors"
                title={theme === 'dark' ? t.settings.themeLight : t.settings.themeDark}
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          )}
          <button
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border border-theme-secondary px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover"
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
