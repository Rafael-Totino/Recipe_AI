import { useMemo } from 'react';

import type { Recipe } from '../../types';
import './recipes.css';

interface RecipeCardProps {
  recipe: Recipe;
  onOpen: (recipeId: string) => void;
  onToggleFavorite: (recipeId: string) => void;
}

const RecipeCard = ({ recipe, onOpen, onToggleFavorite }: RecipeCardProps) => {
  const coverStyle = useMemo(() => {
    if (recipe.coverImage) {
      return { backgroundImage: `url(${recipe.coverImage})` };
    }
    return {
      background: 'linear-gradient(135deg, rgba(91,62,234,0.22), rgba(255,146,72,0.18))'
    };
  }, [recipe.coverImage]);

  return (
    <article className="recipe-card">
      <div className="recipe-card__cover" style={coverStyle}>
        <button
          type="button"
          className={`recipe-card__favorite ${recipe.isFavorite ? 'is-favorite' : ''}`}
          onClick={() => onToggleFavorite(recipe.id)}
          aria-pressed={recipe.isFavorite}
        >
          <span className="recipe-card__favorite-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M12 17.3l6.18 3.86-1.64-7.03L21.5 9.9l-7.19-.62L12 2.7 9.69 9.28 2.5 9.9l4.96 4.23-1.64 7.03z"
              />
            </svg>
          </span>
          <span className="recipe-card__sr">
            {recipe.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          </span>
        </button>
      </div>
      <div className="recipe-card__content">
        <h3>{recipe.title}</h3>
        <p>{recipe.description ?? 'Receita adicionada recentemente ao seu livro digital.'}</p>
        <div className="recipe-card__meta">
          {recipe.durationMinutes ? <span>{recipe.durationMinutes} min</span> : null}
          {recipe.servings ? <span>{recipe.servings} porcoes</span> : null}
          {recipe.difficulty ? <span>Dificuldade: {recipe.difficulty}</span> : null}
        </div>
      </div>
      <div className="recipe-card__actions">
        <button type="button" className="button button--primary" onClick={() => onOpen(recipe.id)}>
          Ver detalhes
        </button>
      </div>
    </article>
  );
};

export default RecipeCard;
