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
      backgroundImage:
        'linear-gradient(135deg, rgba(155, 89, 182, 0.28), rgba(232, 93, 4, 0.28)), url(https://images.unsplash.com/photo-1473091534298-04dcbce3278c?auto=format&fit=crop&w=1200&q=60)'
    };
  }, [recipe.coverImage]);

  const lastTouched = recipe.updatedAt ?? recipe.createdAt;
  const formattedDate = useMemo(() => {
    if (!lastTouched) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short'
      }).format(new Date(lastTouched));
    } catch {
      return '';
    }
  }, [lastTouched]);

  return (
    <article className="recipe-card">
      <div className="recipe-card__media" style={coverStyle} aria-hidden="true">
        <span className="recipe-card__media-overlay" />
      </div>

      <button
        type="button"
        className={`recipe-card__favorite${recipe.isFavorite ? ' is-favorite' : ''}`}
        onClick={() => onToggleFavorite(recipe.id)}
        aria-pressed={recipe.isFavorite}
        aria-label={recipe.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        <span aria-hidden="true" className="recipe-card__favorite-icon">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M11.646 20.91c-.12-.082-.236-.161-.348-.238a25.006 25.006 0 0 1-3.746-3.102C5.517 15.445 2.75 12.44 2.75 8.75c0-2.9 2.23-5.25 5-5.25 1.701 0 3.217.91 4.25 2.182C13.033 4.41 14.55 3.5 16.25 3.5c2.77 0 5 2.35 5 5.25 0 3.69-2.767 6.695-4.802 8.82a25.006 25.006 0 0 1-3.746 3.102c-.112.077-.228.156-.348.238a.75.75 0 0 1-.908 0Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </button>

      <div className="recipe-card__body">
        {formattedDate ? <span className="recipe-card__timestamp">Atualizada em {formattedDate}</span> : null}
        <h3>{recipe.title}</h3>
        <p>{recipe.description ?? 'Receita recém importada esperando sua assinatura pessoal.'}</p>
        <div className="recipe-card__meta">
          {recipe.durationMinutes ? <span>⏱️ {recipe.durationMinutes} min</span> : null}
          {recipe.servings ? <span>🍽️ {recipe.servings} porções</span> : null}
          {recipe.difficulty ? <span>🔥 {recipe.difficulty}</span> : null}
        </div>
        <button
          type="button"
          className="recipe-card__open"
          onClick={() => onOpen(recipe.id)}
          aria-label={`Abrir detalhes da receita ${recipe.title}`}
        >
          Ver detalhes
          <span aria-hidden="true" className="recipe-card__open-icon">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M8 5h11v11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 16 19 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>
    </article>
  );
};

export default RecipeCard;
