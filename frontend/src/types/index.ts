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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  chatId: string;
  relatedRecipeIds?: string[];
  suggestions?: Array<{ label: string; prompt: string }>;
}

export interface ImportResult {
  recipe: Recipe;
  warnings?: string[];
}

