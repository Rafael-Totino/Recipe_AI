import { apiRequest } from './api';
import type { ImportResult, Recipe, RecipeListResponse } from '../types';

export interface RecipePayload extends Partial<Recipe> {
  title: string;
}

export interface FetchRecipesOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export const fetchRecipes = (token: string, options: FetchRecipesOptions = {}) => {
  const params = new URLSearchParams();
  const searchTerm = options.search?.trim();
  if (searchTerm) {
    params.set('q', searchTerm);
  }
  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (typeof options.offset === 'number') {
    params.set('offset', String(options.offset));
  }

  const queryString = params.toString();
  const path = queryString ? `/recipes?${queryString}` : '/recipes';

  return apiRequest<RecipeListResponse>(path, {
    method: 'GET',
    authToken: token
  });
};

export const fetchRecipe = (token: string, recipeId: string) =>
  apiRequest<Recipe>(`/recipes/${recipeId}`, {
    method: 'GET',
    authToken: token
  });

export const createRecipe = (token: string, payload: RecipePayload) =>
  apiRequest<Recipe>('/recipes', {
    method: 'POST',
    authToken: token,
    body: JSON.stringify(payload)
  });

export const importRecipeFromUrl = (token: string, url: string) =>
  apiRequest<ImportResult>('/recipes/import', {
    method: 'POST',
    authToken: token,
    body: JSON.stringify({ url })
  });

export const importRecipeFromImage = (token: string, file: File) => {
  const formData = new FormData();
  formData.append('image', file);

  return apiRequest<ImportResult>('/recipes/import/image', {
    method: 'POST',
    authToken: token,
    body: formData
  });
};

export const updateRecipeNotes = (token: string, recipeId: string, notes: string) =>
  apiRequest<Recipe>(`/recipes/${recipeId}/notes`, {
    method: 'PUT',
    authToken: token,
    body: JSON.stringify({ notes })
  });

export const toggleFavorite = (token: string, recipeId: string, isFavorite: boolean) =>
  apiRequest<Recipe>(`/recipes/${recipeId}/favorite`, {
    method: isFavorite ? 'DELETE' : 'POST',
    authToken: token
  });

export const deleteRecipe = (token: string, recipeId: string) =>
  apiRequest<void>(`/recipes/${recipeId}`, {
    method: 'DELETE',
    authToken: token
  });
