import { apiRequest } from './api';
import type { ImportResult, Recipe } from '../types';

export interface RecipePayload extends Partial<Recipe> {
  title: string;
}

export const fetchRecipes = (token: string) =>
  apiRequest<Recipe[]>('/recipes', {
    method: 'GET',
    authToken: token
  });

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
