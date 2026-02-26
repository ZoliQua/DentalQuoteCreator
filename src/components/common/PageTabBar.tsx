import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface PageTab {
  key: string;
  to: string;
  label: string;
  icon?: ReactNode;
}

interface PageTabBarProps {
  tabs: PageTab[];
}

export function PageTabBar({ tabs }: PageTabBarProps) {
  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          end={tab.to === '/data' || tab.to === '/settings'}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'border-dental-600 text-dental-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`
          }
        >
          {tab.icon}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
