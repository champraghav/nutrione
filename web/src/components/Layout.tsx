import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAppStore } from '@store/app.store';

interface NavItem {
  to: string;
  label: string;
}

/** The things you touch most days sit in the bar itself. */
const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/habits', label: 'Habits' },
  { to: '/fitness', label: 'Fitness' },
  { to: '/sleep', label: 'Sleep' },
  { to: '/coach', label: 'AI Coach' },
];

/** Reference and setup screens, behind a menu so the bar never overflows. */
const SECONDARY_NAV: NavItem[] = [
  { to: '/library', label: 'Library' },
  { to: '/vitals', label: 'Vitals' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/profile', label: 'Profile' },
  { to: '/import', label: 'Import' },
  { to: '/settings', label: 'Settings' },
];

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const activeHere = SECONDARY_NAV.some((item) => item.to === location.pathname);

  // Close on outside click and on Escape, so the menu never gets stuck open.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Navigating away should dismiss it.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={clsx(
          'px-2.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-smooth',
          activeHere ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
        )}
      >
        More ▾
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
          {SECONDARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'block px-3 py-2 text-sm',
                  isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAppStore();

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-lg font-bold text-primary-700 shrink-0">Health OS</span>
              <div className="hidden sm:flex items-center gap-0.5 min-w-0">
                {PRIMARY_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'px-2.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-smooth',
                        isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <MoreMenu />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {user && <span className="text-sm text-gray-500 hidden xl:inline">{user.email}</span>}
              <button className="btn-secondary text-xs" onClick={logout}>
                Log out
              </button>
            </div>
          </div>

          <div className="flex sm:hidden gap-1 pb-2 overflow-x-auto">
            {ALL_NAV.map((item) => (
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
