
import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import './layout.css';

type TopBarProps = {
  forceCondensed?: boolean;
};

const TopBar = ({ forceCondensed }: TopBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') ?? '';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextQuery = params.get('q') ?? '';
    setQuery((current) => (current === nextQuery ? current : nextQuery));
  }, [location.search]);

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

  const clearSearch = () => {
    setQuery('');
    const params = new URLSearchParams(location.search);
    params.delete('q');
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
              <button type="button" className="topbar__clear" onClick={clearSearch}>
                Limpar
              </button>
            ) : null}
            <button type="submit" className="button button--primary topbar__search-button">
              Pesquisar
            </button>
          </div>
        </form>
      </div>
    </header>
  );
};

export default TopBar;
