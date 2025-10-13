import { NavLink } from 'react-router-dom';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '../../context/AuthContext';
import './layout.css';

type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
};

const Sidebar = () => {
  const { user } = useAuth();

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        path: '/app',
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
        )
      },
      {
        path: '/app/profile',
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
        )
      }
    ],
    []
  );

  const firstName = user?.name?.split(' ')[0] ?? 'Chef';
  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase()
    : 'AI';

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="sidebar__brand-text">
          <span className="eyebrow">Livro inteligente</span>
          <p className="sidebar__welcome">Olá, {firstName}</p>
          {user?.email ? <p className="sidebar__email">{user.email}</p> : null}
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Navegacao principal">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/app'}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
            }
            data-label={item.label}
          >
            <span className="sidebar-link__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sidebar-link__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
