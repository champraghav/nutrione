import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAppStore } from '@store/app.store';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/fitness', label: 'Fitness' },
  { to: '/sleep', label: 'Sleep' },
  { to: '/coach', label: 'AI Coach' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const { user, logout } = useAppStore();

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-lg font-bold text-primary-700">Health OS</span>
              <div className="hidden sm:flex items-center gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'px-3 py-1.5 rounded-md text-sm font-medium transition-smooth',
                        isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>}
              <button className="btn-secondary text-xs" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
          <div className="flex sm:hidden gap-1 pb-2 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap',
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
