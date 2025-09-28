import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useRecipes } from '../../context/RecipeContext';
import './layout.css';

const TopBar = () => {
  const { user, logout } = useAuth();
  const { recipes } = useRecipes();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [isCondensed, setIsCondensed] = useState(false);

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

  useEffect(() => {
    const onScroll = () => {
      setIsCondensed(window.scrollY > 64);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'Chef';
  const timeOfDay = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <header className={`topbar${isCondensed ? ' topbar--condensed' : ''}`}>
      <div className="topbar__glass">
        <div className="topbar__intro">
          <p className="topbar__greeting">{timeOfDay}, {firstName}!</p>
          <p className="topbar__subtitle">
            Seu atelier está organizado, com {recipes.length} receitas prontas para ganhar uma nova releitura.
          </p>
        </div>

        <div className="topbar__stats" aria-label="Resumo das receitas">
          <span className="topbar__badge">{recipes.length} receitas</span>
          <span className="topbar__badge">{favoriteCount} favoritas</span>
        </div>

        <div className="topbar__actions">
          <button type="button" onClick={logout} className="button button--ghost topbar__logout">
            Sair
          </button>
        </div>

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
    </header>
  );
};

export default TopBar;
