import { Search, MessageCircle } from 'lucide-react';
import type { Recipe } from '../../types';
import './search-dropdown.css';

type SearchDropdownProps = {
  query: string;
  recipes: Recipe[];
  isLoading: boolean;
  onSelectRecipe: (recipe: Recipe) => void;
  onAskAI: (question: string) => void;
};

const buildMeta = (recipe: Recipe) => {
  const pieces = [
    recipe.durationMinutes ? `${recipe.durationMinutes} min` : undefined,
    recipe.difficulty
  ].filter(Boolean);
  return pieces.join(' • ') || 'Ver detalhes';
};

export function SearchDropdown({
  query,
  recipes,
  isLoading,
  onSelectRecipe,
  onAskAI
}: SearchDropdownProps) {
  if (!query) return null;

  const suggestions = [
    {
      type: 'ai',
      text: `"${query}" - Perguntar ao Chef IA`,
      action: () => onAskAI(query)
    },
    {
      type: 'ai',
      text: `Criar uma receita de ${query}`,
      action: () => onAskAI(`Crie uma receita de ${query}`)
    },
    {
      type: 'ai',
      text: `Dicas e variacoes para ${query}`,
      action: () => onAskAI(`Me de dicas e variacoes para fazer ${query}`)
    }
  ];

  return (
    <div className="search-dropdown">
      <div className="search-dropdown__section">
        <h3 className="search-dropdown__heading">
          <Search size={16} />
          <span>Receitas encontradas</span>
        </h3>
        <div className="search-dropdown__content">
          {isLoading ? (
            <div className="search-dropdown__loading">Buscando receitas...</div>
          ) : recipes.length > 0 ? (
            <ul className="search-dropdown__list">
              {recipes.slice(0, 3).map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    className="search-dropdown__item"
                    onClick={() => onSelectRecipe(recipe)}
                  >
                    {recipe.coverImage ? (
                      <img
                        src={recipe.coverImage}
                        alt=""
                        className="search-dropdown__recipe-image"
                      />
                    ) : null}
                    <span className="search-dropdown__recipe-info">
                      <span className="search-dropdown__recipe-title">{recipe.title}</span>
                      <span className="search-dropdown__recipe-meta">{buildMeta(recipe)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {recipes.length > 3 && (
                <li className="search-dropdown__more">
                  + {recipes.length - 3} receitas encontradas
                </li>
              )}
            </ul>
          ) : (
            <div className="search-dropdown__empty">Nenhuma receita encontrada</div>
          )}
        </div>
      </div>

      <div className="search-dropdown__section">
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
