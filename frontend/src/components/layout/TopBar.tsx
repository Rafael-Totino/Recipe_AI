
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SearchDropdown } from './SearchDropdown';
import { useRecipes } from '../../context/RecipeContext';
import type { Recipe } from '../../types';

import './layout.css';

type TopBarProps = {
  forceCondensed?: boolean;
};

const TopBar = ({ forceCondensed }: TopBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { recipes, isLoading } = useRecipes();
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') ?? '';
  });
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Filtra as receitas baseado na query
  const filteredRecipes = recipes.filter(recipe =>
    recipe.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleRecipeSelect = (recipe: Recipe) => {
    setShowDropdown(false);
    navigate(`/app/recipes/${recipe.id}`);
  };

  const handleAskAI = (question: string) => {
    setShowDropdown(false);
    // TODO: Implementar a lógica para abrir o modal do chat com a pergunta
  };

  // Fecha o dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={topbarClassName}>
      <div className="topbar__glass" role="search" ref={containerRef}>
        <form onSubmit={handleSearch} className="topbar__search">
          <Search size={20} className="topbar__search-icon" />
          <input
            id="recipe-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Busque receitas ou converse com o Chef IA..."
            aria-label="Buscar receitas ou fazer perguntas"
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
        {showDropdown && query && (
          <SearchDropdown
            query={query}
            recipes={filteredRecipes}
            isLoading={isLoading}
            onSelectRecipe={handleRecipeSelect}
            onAskAI={handleAskAI}
          />
        )}
      </div>
    </header>
  );
};

export default TopBar;
