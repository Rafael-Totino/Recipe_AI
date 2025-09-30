import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useRecipes } from '../../context/RecipeContext';
import './layout.css';
import { useTheme } from '../../context/ThemeContext';

type TopBarProps = {
  forceCondensed?: boolean;
};

const TopBar = ({ forceCondensed }: TopBarProps) => {
  const { user } = useAuth();
  const { recipes } = useRecipes();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const view = searchParams.get('view');

  const favoriteCount = useMemo(
    () => recipes.filter((recipe) => recipe.isFavorite).length,
    [recipes]
  );

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


  const firstName = user?.name?.split(' ')[0] ?? 'Chef';
  const timeOfDay = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const topbarClassName = `topbar${forceCondensed ? ' topbar--condensed' : ''}`;

  return (
    <header className={topbarClassName}>
      <div className="topbar__glass">
        <div className="topbar__header">
          <div className="topbar__titles">
            <span className="topbar__eyebrow">{timeOfDay}, {firstName}</span>
            <h1 className="topbar__title">Timeline das suas receitas</h1>
            <p className="topbar__subtitle">
              Uma jornada cronológica para sua culinária autoral ganhar novas releituras e inspirações.
            </p>
          </div>
          <div className="topbar__actions">
            <button
              type="button"
              onClick={toggleTheme}
              className="button button--ghost topbar__theme-toggle"
              aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
              title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              <span aria-hidden="true">{theme === 'dark' ? '🌞' : '🌙'}</span>
            </button>
          </div>
        </div>

        <div className="topbar__search-card">
          <form onSubmit={handleSearch} className="topbar__search" role="search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque receitas ou peça uma nova criação ao atelier"
              aria-label="Buscar receitas"
            />
            <button type="submit" className="button button--primary topbar__search-button">
              Pesquisar
            </button>
          </form>
        </div>

        <div className="topbar__meta" aria-label="Resumo das receitas">
          <span className="topbar__chip">
            {recipes.length} {recipes.length === 1 ? 'receita' : 'receitas'}
          </span>
          <span className="topbar__chip">
            {favoriteCount} {favoriteCount === 1 ? 'favorita' : 'favoritas'}
          </span>
          {view === 'favorites' ? (
            <span className="topbar__chip topbar__chip--accent">Filtrando favoritas</span>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
