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
          <svg viewBox="0 0 512 512" focusable="false">
            <path
              className="recipe-card__favorite-heart-fill"
              d="M256 468.5s-34-28.5-68-57c-109-93-156-144-156-219.5C32 104 91 48 164 48c43 0 83 23 104 62 21-39 61-62 104-62 73 0 132 56 132 144 0 75.5-47 126.5-156 219.5-34 28.5-68 57-68 57Z"
            />
            <g fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M256 468.5s-34-28.5-68-57c-109-93-156-144-156-219.5C32 104 91 48 164 48c43 0 83 23 104 62 21-39 61-62 104-62 73 0 132 56 132 144 0 75.5-47 126.5-156 219.5-34 28.5-68 57-68 57Z" />
              <path d="M180 118c-8-19-28-32-52-32-31 0-56 23-56 52 0 14 6 27 16 36" />
              <path d="M228 80c0-24.5-19.5-44-44-44-16 0-30 8.5-38 21" />
              <path d="M312 104h84" />
              <path d="M308 152h96" />
              <path d="M404 152v-24c0-26.5-21.5-48-48-48h-12c-26.5 0-48 21.5-48 48v24" />
            </g>
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
