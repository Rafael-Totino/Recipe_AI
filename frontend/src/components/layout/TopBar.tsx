import { FormEvent, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import './layout.css';
import { useTheme } from '../../context/ThemeContext';

type TopBarProps = {
  forceCondensed?: boolean;
};

const TopBar = ({ forceCondensed }: TopBarProps) => {
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(location.search);
    if (query) {
      params.set('q', query);
    } else {
      params.delete('q');
    }
    navigate({ pathname: location.pathname, search: params.toString() });
  };
  const topbarClassName = `topbar${forceCondensed ? ' topbar--condensed' : ''}`;

  return (
    <header className={topbarClassName}>
      <div className="topbar__glass" role="search">
        <form onSubmit={handleSearch} className="topbar__search">
          <label className="sr-only" htmlFor="recipe-search">
            Buscar receitas
          </label>
          <input
            id="recipe-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque receitas ou peça uma nova criação ao atelier"
            aria-label="Buscar receitas"
          />
          <div className="topbar__search-actions">
            {query ? (
              <button
                type="button"
                className="topbar__clear"
                onClick={() => {
                  setQuery('');
                  const params = new URLSearchParams(location.search);
                  params.delete('q');
                  navigate({ pathname: location.pathname, search: params.toString() });
                }}
              >
                Limpar
              </button>
            ) : null}
            <button type="submit" className="button button--primary topbar__search-button">
              Pesquisar
            </button>
          </div>
        </form>
        <button
          type="button"
          onClick={toggleTheme}
          className="topbar__theme-toggle"
          aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '🌞' : '🌙'}</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
