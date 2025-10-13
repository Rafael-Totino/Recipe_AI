import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import './layout.css';

type BottomNavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  to?: string | { pathname: string; search?: string };
  onClick?: () => void;
  isActive: boolean;
};

type BottomNavProps = {
  onOpenImportOptions: () => void;
  isImportFlowOpen?: boolean;
};

const BottomNav = ({ onOpenImportOptions, isImportFlowOpen = false }: BottomNavProps) => {
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

  const isChatRoute = location.pathname.startsWith('/app/chat');

  const navItems: BottomNavItem[] = [
    {
      key: 'home',
      label: 'Inicio',
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
      key: 'chat',
      label: 'Chef IA',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 3C17.5228 3 22 6.58172 22 11C22 15.4183 17.5228 19 12 19C11.1558 19 10.3373 18.9179 9.54992 18.7646L5.40604 20.4188C4.91882 20.6223 4.43123 20.2733 4.51272 19.7447L5.03602 16.6911C3.17765 15.2987 2 13.2595 2 11C2 6.58172 6.47715 3 12 3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 11H16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M10 15H14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
      to: '/app/chat',
      isActive: isChatRoute
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
      onClick: onOpenImportOptions,
      isActive: isImportFlowOpen
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
      to: '/app/playlists',
      isActive: location.pathname.startsWith('/app/playlists')
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
    <>
      <nav className="bottom-nav" aria-label="Navegacao principal">
        <div className="bottom-nav__inner">
          {navItems.map((item) => {
            const itemClasses = ['bottom-nav__item'];
            if (item.key === 'import') {
              itemClasses.push('bottom-nav__item--import');
            }
            if (item.isActive) {
              itemClasses.push('bottom-nav__item--active');
            }

            return item.to ? (
              <Link
                key={item.key}
                to={item.to}
                className={itemClasses.join(' ')}
                aria-current={item.isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="bottom-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="bottom-nav__label">{item.label}</span>
              </Link>
            ) : (
              <button
                key={item.key}
                onClick={item.onClick}
                className={itemClasses.join(' ')}
                type="button"
                aria-label={item.label}
                aria-current={item.isActive ? 'page' : undefined}
              >
                <span className="bottom-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="bottom-nav__label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
