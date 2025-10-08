export type SocialProvider = 'google';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  preferences?: {
    dietaryRestrictions?: string[];
    dislikedIngredients?: string[];
    favoriteCuisines?: string[];
  };
}

export interface RecipeStep {
  order: number;
  description: string;
  durationMinutes?: number;
  tips?: string;
}

export interface IngredientItem {
  name: string;
  quantity?: string;
  notes?: string;
}

export interface RecipeMedia {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  provider?: 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'generic';
}

export interface RecipeSource {
  link?: string;
  importedFrom?: 'youtube' | 'instagram' | 'tiktok' | 'blog' | 'manual';
  importedAt?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  isFavorite?: boolean;
  durationMinutes?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  coverImage?: string;
  ingredients?: IngredientItem[];
  steps?: RecipeStep[];
  notes?: string;
  source?: RecipeSource;
  media?: RecipeMedia[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeListResponse {
  items: Recipe[];
  total: number;
  limit: number;
  offset: number;
}

export type PlaylistType = 'system' | 'custom';

export interface PlaylistSummary {
  id: string;
  name: string;
  slug: string;
  type: PlaylistType;
  description?: string | null;
  recipeCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PlaylistItem {
  recipeId: string;
  addedAt?: string | null;
  position?: number | null;
  recipe: Recipe;
}

export interface PlaylistDetail extends PlaylistSummary {
  items: PlaylistItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  chatId: string;
  relatedRecipeIds?: string[];
  suggestions?: Array<{ label: string; prompt: string }>;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ImportResult {
  recipe: Recipe;
  warnings?: string[];
}

