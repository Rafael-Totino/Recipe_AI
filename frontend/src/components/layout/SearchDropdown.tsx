import { Search, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Recipe } from '../../types';
import './search-dropdown.css';

type SearchDropdownProps = {
  query: string;
  recipes: Recipe[];
  total: number;
  canSearch: boolean;
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onAskAI: (question: string) => void;
};

const buildMeta = (recipe: Recipe) => {
  const pieces = [
    recipe.durationMinutes ? `${recipe.durationMinutes} min` : undefined,
    recipe.difficulty
  ].filter(Boolean);
  return pieces.join('  ') || 'Ver detalhes';
};

export function SearchDropdown({
  query,
  recipes,
  total,
  canSearch,
  isLoading,
  hasMore,
  onLoadMore,
  onSelectRecipe,
  onAskAI
}: SearchDropdownProps) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  const suggestions = [
    {
      type: 'ai',
      text: `"${trimmedQuery}" - Perguntar ao Chef IA`,
      action: () => onAskAI(trimmedQuery)
    },
    {
      type: 'ai',
      text: `Criar uma receita de ${trimmedQuery}`,
      action: () => onAskAI(`Crie uma receita de ${trimmedQuery}`)
    },
    {
      type: 'ai',
      text: `Dicas e variacoes para ${trimmedQuery}`,
      action: () => onAskAI(`Me de dicas e variacoes para fazer ${trimmedQuery}`)
    }
  ];

  let recipeContent: ReactNode;

  if (!canSearch) {
    recipeContent = (
      <div className="search-dropdown__empty">
        Digite pelo menos 2 caracteres para buscar receitas.
      </div>
    );
  } else if (isLoading && recipes.length === 0) {
    recipeContent = <div className="search-dropdown__loading">Buscando receitas...</div>;
  } else if (recipes.length > 0) {
    recipeContent = (
      <ul className="search-dropdown__list">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <button
              type="button"
              className="search-dropdown__item"
              onClick={() => onSelectRecipe(recipe)}
            >
              {recipe.coverImage ? (
                <img src={recipe.coverImage} alt="" className="search-dropdown__recipe-image" />
              ) : null}
              <span className="search-dropdown__recipe-info">
                <span className="search-dropdown__recipe-title">{recipe.title}</span>
                <span className="search-dropdown__recipe-meta">{buildMeta(recipe)}</span>
              </span>
            </button>
          </li>
        ))}
        {total > recipes.length ? (
          <li className="search-dropdown__more">
            + {total - recipes.length} receitas encontradas
          </li>
        ) : null}
        {hasMore && onLoadMore ? (
          <li className="search-dropdown__more">
            <button
              type="button"
              className="search-dropdown__load-more"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? 'Carregando...' : 'Mostrar mais resultados'}
            </button>
          </li>
        ) : null}
      </ul>
    );
  } else {
    recipeContent = <div className="search-dropdown__empty">Nenhuma receita encontrada</div>;
  }

  return (
    <div className="search-dropdown">
      <div className="search-dropdown__section search-dropdown__section--recipes">
        <h3 className="search-dropdown__heading">
          <Search size={16} />
          <span>Receitas encontradas</span>
        </h3>
        <div className="search-dropdown__content">{recipeContent}</div>
      </div>

      <div className="search-dropdown__section search-dropdown__section--ai">
        <h3 className="search-dropdown__heading">
          <MessageCircle size={16} />
          <span>Pergunte ao Chef IA</span>
        </h3>
        <div className="search-dropdown__content">
          <ul className="search-dropdown__list">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="search-dropdown__item search-dropdown__item--ai"
                  onClick={suggestion.action}
                >
                  <span>{suggestion.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
