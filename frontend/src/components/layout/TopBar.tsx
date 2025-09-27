import { FormEvent, useMemo, useState } from 'react';
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

  return (
    <header className="topbar">
      <div className="topbar__content">
        <span className="eyebrow topbar__eyebrow">Livro de receitas com IA</span>
        <div className="topbar__headline">
          <h1>Ola, {firstName}</h1>
          <button type="button" onClick={logout} className="button button--ghost topbar__logout">
            Sair
          </button>
        </div>
        <p className="topbar__subtitle">
          {favoriteCount > 0
            ? `Chef IA acompanha suas ${favoriteCount} favoritas e sugere novas combinacoes em segundos.`
            : 'Chef IA esta pronto para aprender com suas receitas e criar cardapios personalizados.'}
        </p>
        <div className="topbar__badges">
          <span className="badge">{recipes.length} receitas salvas</span>
          <span className="badge">{favoriteCount} favoritas</span>
        </div>
        <form onSubmit={handleSearch} className="topbar__search" role="search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque receitas ou pergunte algo ao Chef IA"
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
