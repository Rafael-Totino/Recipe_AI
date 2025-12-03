import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import type { ImportResult, Recipe } from '../types';
import {
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipes,
  importRecipeFromUrl,
  importRecipeFromImage,
  toggleFavorite,
  updateRecipeNotes
} from '../services/recipes';
import { useAuth } from './AuthContext';

interface RecipeContextValue {
  recipes: Recipe[];
  searchResults: Recipe[];
  searchTerm: string;
  searchTotal: number;
  activeRecipe?: Recipe;
  isLoading: boolean;
  isSearching: boolean;
  hasMoreSearchResults: boolean;
  loadRecipes: () => Promise<void>;
  searchRecipes: (term: string) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  resetSearch: () => void;
  selectRecipe: (recipeId: string) => Promise<void>;
  importRecipe: (url: string) => Promise<ImportResult | null>;
  importRecipeFromImage: (file: File) => Promise<ImportResult | null>;
  createManualRecipe: (payload: Partial<Recipe> & { title: string }) => Promise<Recipe | null>;
  updateNotes: (recipeId: string, notes: string) => Promise<Recipe | null>;
  toggleFavorite: (recipeId: string) => Promise<void>;
  removeRecipe: (recipeId: string) => Promise<void>;
}

const RecipeContext = createContext<RecipeContextValue | undefined>(undefined);

export const RecipeProvider = ({ children }: { children: ReactNode }) => {
  const DEFAULT_COLLECTION_LIMIT = 50;
  const SEARCH_PAGE_SIZE = 20;
  const SEARCH_MIN_LENGTH = 2;

  const { session } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestRef = useRef(0);

  const resetSearchState = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchTerm('');
    setSearchResults([]);
    setSearchTotal(0);
    setSearchOffset(0);
    setIsSearching(false);
  }, []);

  const loadRecipes = useCallback(async () => {
    if (!session?.access_token) {
      setRecipes([]);
      return;
    }
    setIsLoading(true);
    try {
      const result = await fetchRecipes(session.access_token, {
        limit: DEFAULT_COLLECTION_LIMIT,
        offset: 0
      });
      setRecipes(Array.isArray(result?.items) ? result.items : []);
    } catch (error) {
      console.error('Unable to fetch recipes', error);
    } finally {
      setIsLoading(false);
    }
  }, [DEFAULT_COLLECTION_LIMIT, session?.access_token]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    if (!session?.access_token) {
      resetSearchState();
    }
  }, [resetSearchState, session?.access_token]);

  const executeSearch = useCallback(
    async (term: string, append: boolean) => {
      if (!session?.access_token) {
        resetSearchState();
        return;
      }

      const normalized = term.trim();
      if (!append && normalized.length < SEARCH_MIN_LENGTH) {
        resetSearchState();
        return;
      }

      if (append) {
        if (!searchTerm || normalized !== searchTerm || searchResults.length >= searchTotal) {
          return;
        }
      }

      const requestId = append ? searchRequestRef.current : searchRequestRef.current + 1;
      if (!append) {
        searchRequestRef.current = requestId;
      }

      setIsSearching(true);
      const nextOffset = append ? searchOffset : 0;

      try {
        const result = await fetchRecipes(session.access_token, {
          search: normalized,
          limit: SEARCH_PAGE_SIZE,
          offset: nextOffset
        });

        if (searchRequestRef.current !== requestId) {
          return;
        }

        const items = Array.isArray(result?.items) ? result.items : [];
        const total = typeof result?.total === 'number' ? result.total : items.length;

        setSearchTerm(normalized);
        setSearchTotal(total);
        setSearchOffset(nextOffset + items.length);
        setSearchResults((prev) => (append ? [...prev, ...items] : items));
      } catch (error) {
        if (!append) {
          resetSearchState();
        }
        console.error('Unable to search recipes', error);
      } finally {
        if (searchRequestRef.current === requestId) {
          setIsSearching(false);
        }
      }
    },
    [
      SEARCH_MIN_LENGTH,
      SEARCH_PAGE_SIZE,
      resetSearchState,
      searchOffset,
      searchResults.length,
      searchTerm,
      searchTotal,
      session?.access_token
    ]
  );

  const searchRecipesHandler = useCallback(
    async (term: string) => {
      await executeSearch(term, false);
    },
    [executeSearch]
  );

  const loadMoreSearchResults = useCallback(async () => {
    if (!searchTerm || searchResults.length >= searchTotal) {
      return;
    }
    await executeSearch(searchTerm, true);
  }, [executeSearch, searchResults.length, searchTerm, searchTotal]);

  const hasMoreSearchResults = useMemo(
    () => searchResults.length < searchTotal,
    [searchResults.length, searchTotal]
  );

  const selectRecipe = useCallback(
    async (recipeId: string) => {
      if (!session?.access_token) {
        return;
      }
      try {
        const recipe = await fetchRecipe(session.access_token, recipeId);
        setActiveRecipe(recipe);
      } catch (error) {
        console.error('Unable to fetch recipe detail', error);
      }
    },
    [session?.access_token]
  );

  const importRecipeHandler = useCallback(
    async (url: string) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        const result = await importRecipeFromUrl(session.access_token, url);
        setRecipes((prev) => [result.recipe, ...prev]);
        return result;
      } catch (error) {
        console.error('Unable to import recipe', error);
        return null;
      }
    },
    [session?.access_token]
  );

  const createManualRecipeHandler = useCallback(
    async (payload: Partial<Recipe> & { title: string }) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        const recipe = await createRecipe(session.access_token, payload);
        setRecipes((prev) => [recipe, ...prev]);
        return recipe;
      } catch (error) {
        console.error('Unable to create recipe', error);
        return null;
      }
    },
    [session?.access_token]
  );

  const updateNotesHandler = useCallback(
    async (recipeId: string, notes: string) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        const updated = await updateRecipeNotes(session.access_token, recipeId, notes);
        setRecipes((prev) => prev.map((item) => (item.id === recipeId ? updated : item)));
        setActiveRecipe((prev) => (prev?.id === recipeId ? updated : prev));
        return updated;
      } catch (error) {
        console.error('Unable to update notes', error);
        return null;
      }
    },
    [session?.access_token]
  );

  const toggleFavoriteHandler = useCallback(
    async (recipeId: string) => {
      if (!session?.access_token) {
        return;
      }
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        return;
      }
      const isFavorite = Boolean(recipe.isFavorite);
      try {
        const updated = await toggleFavorite(session.access_token, recipeId, isFavorite);
        setRecipes((prev) => prev.map((item) => (item.id === recipeId ? updated : item)));
        setActiveRecipe((prev) => (prev?.id === recipeId ? updated : prev));
      } catch (error) {
        console.error('Unable to toggle favorite', error);
      }
    },
    [recipes, session?.access_token]
  );

  const removeRecipeHandler = useCallback(
    async (recipeId: string) => {
      if (!session?.access_token) {
        return;
      }
      try {
        await deleteRecipe(session.access_token, recipeId);
        setRecipes((prev) => prev.filter((item) => item.id !== recipeId));
        setActiveRecipe((prev) => (prev?.id === recipeId ? undefined : prev));
      } catch (error) {
        console.error('Unable to delete recipe', error);
      }
    },
    [session?.access_token]
  );

  const importRecipeFromImageHandler = useCallback(
    async (file: File) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        const result = await importRecipeFromImage(session.access_token, file);
        setRecipes((prev) => [result.recipe, ...prev]);
        return result;
      } catch (error) {
        console.error('Unable to import recipe from image', error);
        return null;
      }
    },
    [session?.access_token]
  );

  const value = useMemo(
    () => ({
      recipes,
      searchResults,
      searchTerm,
      searchTotal,
      activeRecipe,
      isLoading,
      isSearching,
      hasMoreSearchResults,
      loadRecipes,
      searchRecipes: searchRecipesHandler,
      loadMoreSearchResults,
      resetSearch: resetSearchState,
      selectRecipe,
      importRecipe: importRecipeHandler,
      importRecipeFromImage: importRecipeFromImageHandler,
      createManualRecipe: createManualRecipeHandler,
      updateNotes: updateNotesHandler,
      toggleFavorite: toggleFavoriteHandler,
      removeRecipe: removeRecipeHandler
    }),
    [
      activeRecipe,
      createManualRecipeHandler,
      hasMoreSearchResults,
      importRecipeHandler,
      isSearching,
      isLoading,
      loadMoreSearchResults,
      loadRecipes,
      resetSearchState,
      importRecipeFromImageHandler,
      searchRecipesHandler,
      searchResults,
      searchTerm,
      searchTotal,
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

