import type { Recipe } from '../../types';
import RecipeCard from './RecipeCard';
import './recipes.css';

interface RecipeGridProps {
  recipes: Recipe[];
  onOpenRecipe: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  emptyMessage?: string;
}

const RecipeGrid = ({ recipes, onOpenRecipe, onToggleFavorite, emptyMessage }: RecipeGridProps) => {
  if (!recipes.length) {
    return <div className="empty-state">{emptyMessage ?? 'Nenhuma receita por aqui ainda.'}</div>;
  }

  return (
    <div className="recipe-grid">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onOpen={onOpenRecipe}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
};

export default RecipeGrid;
