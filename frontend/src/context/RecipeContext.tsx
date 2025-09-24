import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import type { ImportResult, Recipe } from '../types';
import {
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipes,
  importRecipeFromUrl,
  toggleFavorite,
  updateRecipeNotes
} from '../services/recipes';
import { useAuth } from './AuthContext';

interface RecipeContextValue {
  recipes: Recipe[];
  activeRecipe?: Recipe;
  isLoading: boolean;
  loadRecipes: () => Promise<void>;
  selectRecipe: (recipeId: string) => Promise<void>;
  importRecipe: (url: string) => Promise<ImportResult | null>;
  createManualRecipe: (payload: Partial<Recipe> & { title: string }) => Promise<Recipe | null>;
  updateNotes: (recipeId: string, notes: string) => Promise<Recipe | null>;
  toggleFavorite: (recipeId: string) => Promise<void>;
  removeRecipe: (recipeId: string) => Promise<void>;
}

const RecipeContext = createContext<RecipeContextValue | undefined>(undefined);

export const RecipeProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const loadRecipes = useCallback(async () => {
    if (!session?.accessToken) {
      setRecipes([]);
      return;
    }
    setIsLoading(true);
    try {
      const items = await fetchRecipes(session.accessToken);
      setRecipes(items);
    } catch (error) {
      console.error('Unable to fetch recipes', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  const selectRecipe = useCallback(
    async (recipeId: string) => {
      if (!session?.accessToken) {
        return;
      }
      try {
        const recipe = await fetchRecipe(session.accessToken, recipeId);
        setActiveRecipe(recipe);
      } catch (error) {
        console.error('Unable to fetch recipe detail', error);
      }
    },
    [session?.accessToken]
  );

  const importRecipeHandler = useCallback(
    async (url: string) => {
      if (!session?.accessToken) {
        return null;
      }
      try {
        const result = await importRecipeFromUrl(session.accessToken, url);
        setRecipes((prev) => [result.recipe, ...prev]);
        return result;
      } catch (error) {
        console.error('Unable to import recipe', error);
        return null;
      }
    },
    [session?.accessToken]
  );

  const createManualRecipeHandler = useCallback(
    async (payload: Partial<Recipe> & { title: string }) => {
      if (!session?.accessToken) {
        return null;
      }
      try {
        const recipe = await createRecipe(session.accessToken, payload);
        setRecipes((prev) => [recipe, ...prev]);
        return recipe;
      } catch (error) {
        console.error('Unable to create recipe', error);
        return null;
      }
    },
    [session?.accessToken]
  );

  const updateNotesHandler = useCallback(
    async (recipeId: string, notes: string) => {
      if (!session?.accessToken) {
        return null;
      }
      try {
        const updated = await updateRecipeNotes(session.accessToken, recipeId, notes);
        setRecipes((prev) => prev.map((item) => (item.id === recipeId ? updated : item)));
        setActiveRecipe((prev) => (prev?.id === recipeId ? updated : prev));
        return updated;
      } catch (error) {
        console.error('Unable to update notes', error);
        return null;
      }
    },
    [session?.accessToken]
  );

  const toggleFavoriteHandler = useCallback(
    async (recipeId: string) => {
      if (!session?.accessToken) {
        return;
      }
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        return;
      }
      const isFavorite = Boolean(recipe.isFavorite);
      try {
        const updated = await toggleFavorite(session.accessToken, recipeId, isFavorite);
        setRecipes((prev) => prev.map((item) => (item.id === recipeId ? updated : item)));
        setActiveRecipe((prev) => (prev?.id === recipeId ? updated : prev));
      } catch (error) {
        console.error('Unable to toggle favorite', error);
      }
    },
    [recipes, session?.accessToken]
  );

  const removeRecipeHandler = useCallback(
    async (recipeId: string) => {
      if (!session?.accessToken) {
        return;
      }
      try {
        await deleteRecipe(session.accessToken, recipeId);
        setRecipes((prev) => prev.filter((item) => item.id !== recipeId));
        setActiveRecipe((prev) => (prev?.id === recipeId ? undefined : prev));
      } catch (error) {
        console.error('Unable to delete recipe', error);
      }
    },
    [session?.accessToken]
  );

  const value = useMemo(
    () => ({
      recipes,
      activeRecipe,
      isLoading,
      loadRecipes,
      selectRecipe,
      importRecipe: importRecipeHandler,
      createManualRecipe: createManualRecipeHandler,
      updateNotes: updateNotesHandler,
      toggleFavorite: toggleFavoriteHandler,
      removeRecipe: removeRecipeHandler
    }),
    [
      activeRecipe,
      createManualRecipeHandler,
      importRecipeHandler,
      isLoading,
      loadRecipes,
      recipes,
      removeRecipeHandler,
      selectRecipe,
      toggleFavoriteHandler,
      updateNotesHandler
    ]
  );

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
};

export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
};
