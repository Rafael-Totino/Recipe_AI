import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import './layout.css';

type BottomNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  to: string | { pathname: string; search?: string };
  isActive: boolean;
};

const BottomNav = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const view = searchParams.get('view') ?? '';
  const query = searchParams.get('q') ?? '';

  const buildSearch = (nextView?: string) => {
    const params = new URLSearchParams();
    if (nextView) {
      params.set('view', nextView);
    }
    if (query) {
      params.set('q', query);
    }
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
  };

  const navItems: BottomNavItem[] = [
    {
      key: 'home',
      label: 'Início',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3.5 11.25 12 4l8.5 7.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 10.75V20h11V10.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.75 20v-4.5h4.5V20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      to: { pathname: '/app', search: buildSearch() },
      isActive: location.pathname === '/app' && (view === '' || view === 'home')
    },
    {
      key: 'explore',
      label: 'Explorar',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="m9.5 9.5 7-2-2 7-7 2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      to: { pathname: '/app', search: buildSearch('explore') },
      isActive: location.pathname === '/app' && view === 'explore'
    },
    {
      key: 'import',
      label: 'Importar',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 8v8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M8 12h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
      to: '/app/import',
      isActive: location.pathname === '/app/import'
    },
    {
      key: 'favorites',
      label: 'Salvos',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 20.5 5.2 14a4.75 4.75 0 0 1 0-6.8c1.86-1.86 4.89-1.86 6.75 0L12 7.25l0.05-0.05c1.86-1.86 4.89-1.86 6.75 0a4.75 4.75 0 0 1 0 6.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      to: { pathname: '/app', search: buildSearch('favorites') },
      isActive: location.pathname === '/app' && view === 'favorites'
    },
    {
      key: 'profile',
      label: 'Perfil',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle
            cx="12"
            cy="9"
            r="3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M6.2 19.4a5.9 5.9 0 0 1 11.6 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      ),
      to: '/app/profile',
      isActive: location.pathname === '/app/profile'
    }
  ];

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav__inner">
        {navItems.map((item) => {
          const itemClasses = ['bottom-nav__item'];
          if (item.key === 'import') {
            itemClasses.push('bottom-nav__item--import');
          }
          if (item.isActive) {
            itemClasses.push('bottom-nav__item--active');
          }

          return (
            <Link
              key={item.key}
              to={item.to}
              className={itemClasses.join(' ')}
              aria-current={item.isActive ? 'page' : undefined}
            >
              <span className="bottom-nav__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="bottom-nav__label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
