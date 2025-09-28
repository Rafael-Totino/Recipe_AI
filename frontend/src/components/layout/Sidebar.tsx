import { NavLink } from 'react-router-dom';
import { useMemo } from 'react';

import { useAuth } from '../../context/AuthContext';
import './layout.css';

const Sidebar = () => {
  const { user } = useAuth();

  const navItems = useMemo(
    () => [
      { path: '/app', label: 'Visao geral', code: 'VG' },
      { path: '/app/import', label: 'Importar receitas', code: 'IR' },
      { path: '/app/settings', label: 'Preferencias', code: 'PR' }
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
        <div>
          <span className="eyebrow">Livro inteligente</span>
          <p className="sidebar__welcome">Ola, {firstName}</p>
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
              {item.code}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
