import { FormEvent, useEffect, useMemo, useState } from 'react';

import RecipeGrid from '../../components/recipes/RecipeGrid';
import type { Recipe } from '../../types';

import './saved-collections.css';

type SavedCollectionType = 'all' | 'custom' | 'tag';

type SavedCollection = {
  id: string;
  name: string;
  recipeIds: string[];
  createdAt: string;
  type: SavedCollectionType;
};

const STORAGE_KEY = 'recipe-ai:saved-collections';
const FALLBACK_COVER =
  'linear-gradient(135deg, rgba(155, 89, 182, 0.32), rgba(232, 93, 4, 0.32)), url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=60)';

type SavedCollectionsViewProps = {
  favorites: Recipe[];
  onOpenRecipe: (id: string) => void;
  onToggleFavorite: (id: string) => Promise<void>;
};

type CreateCollectionState = {
  isOpen: boolean;
  name: string;
  selectedRecipes: Record<string, boolean>;
  error?: string;
};

const buildDefaultCollection = (recipes: Recipe[]): SavedCollection => ({
  id: 'all-favorites',
  name: 'Todos os favoritos',
  recipeIds: recipes.map((recipe) => recipe.id),
  createdAt: '1970-01-01T00:00:00.000Z',
  type: 'all'
});

const SavedCollectionsView = ({ favorites, onOpenRecipe, onToggleFavorite }: SavedCollectionsViewProps) => {
  const [customCollections, setCustomCollections] = useState<SavedCollection[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((collection): collection is SavedCollection => {
        return (
          typeof collection?.id === 'string' &&
          typeof collection?.name === 'string' &&
          Array.isArray(collection?.recipeIds) &&
          typeof collection?.createdAt === 'string'
        );
      });
    } catch (error) {
      console.warn('Unable to parse saved collections', error);
      return [];
    }
  });

  const [creationState, setCreationState] = useState<CreateCollectionState>({
    isOpen: false,
    name: '',
    selectedRecipes: {}
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customCollections));
  }, [customCollections]);

  useEffect(() => {
    setCreationState((prev) => ({
      ...prev,
      selectedRecipes: favorites.reduce<Record<string, boolean>>((acc, recipe) => {
        if (prev.selectedRecipes[recipe.id]) {
          acc[recipe.id] = true;
        }
        return acc;
      }, {})
    }));
  }, [favorites]);

  const tagCollections = useMemo(() => {
    const tagMap = new Map<string, Set<string>>();

    favorites.forEach((recipe) => {
      recipe.tags?.forEach((tag) => {
        const normalizedTag = tag.trim();
        if (!normalizedTag) {
          return;
        }
        if (!tagMap.has(normalizedTag)) {
          tagMap.set(normalizedTag, new Set());
        }
        tagMap.get(normalizedTag)?.add(recipe.id);
      });
    });

    const collectionEntries = Array.from(tagMap.entries()).map<SavedCollection>(([tag, recipeSet]) => ({
      id: `tag-${tag.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
      name: tag,
      recipeIds: Array.from(recipeSet),
      createdAt: '1970-01-02T00:00:00.000Z',
      type: 'tag'
    }));

    return collectionEntries.sort((a, b) => b.recipeIds.length - a.recipeIds.length).slice(0, 12);
  }, [favorites]);

  const collections = useMemo(() => {
    const defaultCollection = buildDefaultCollection(favorites);
    const filteredCustomCollections = customCollections.map((collection) => ({
      ...collection,
      recipeIds: collection.recipeIds.filter((recipeId) => favorites.some((recipe) => recipe.id === recipeId))
    }));

    return [
      defaultCollection,
      ...filteredCustomCollections.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ...tagCollections
    ];
  }, [customCollections, favorites, tagCollections]);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(() =>
    collections.length ? collections[0].id : ''
  );

  useEffect(() => {
    if (!collections.length) {
      setSelectedCollectionId('');
      return;
    }

    const current = collections.find((collection) => collection.id === selectedCollectionId);
    if (!current) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);

  const selectedRecipes = useMemo(() => {
    if (!selectedCollection) {
      return [];
    }
    return selectedCollection.recipeIds
      .map((id) => favorites.find((recipe) => recipe.id === id))
      .filter((recipe): recipe is Recipe => Boolean(recipe));
  }, [favorites, selectedCollection]);

  const handleOpenCreation = () => {
    setCreationState({
      isOpen: true,
      name: '',
      selectedRecipes: favorites.reduce<Record<string, boolean>>((acc, recipe) => {
        acc[recipe.id] = true;
        return acc;
      }, {})
    });
  };

  const handleToggleSelection = (recipeId: string) => {
    setCreationState((prev) => ({
      ...prev,
      selectedRecipes: {
        ...prev.selectedRecipes,
        [recipeId]: !prev.selectedRecipes[recipeId]
      }
    }));
  };

  const handleCreateCollection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = creationState.name.trim();
    if (!trimmedName) {
      setCreationState((prev) => ({ ...prev, error: 'Informe um nome para a playlist.' }));
      return;
    }

    if (collections.some((collection) => collection.name.toLowerCase() === trimmedName.toLowerCase())) {
      setCreationState((prev) => ({ ...prev, error: 'Ja existe uma playlist com esse nome.' }));
      return;
    }

    const recipeIds = Object.entries(creationState.selectedRecipes)
      .filter(([, isSelected]) => isSelected)
      .map(([recipeId]) => recipeId);

    if (!recipeIds.length) {
      setCreationState((prev) => ({ ...prev, error: 'Selecione ao menos uma receita para a playlist.' }));
      return;
    }

    const newCollection: SavedCollection = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      recipeIds,
      createdAt: new Date().toISOString(),
      type: 'custom'
    };

    setCustomCollections((prev) => [newCollection, ...prev]);
    setCreationState({ isOpen: false, name: '', selectedRecipes: {} });
    setSelectedCollectionId(newCollection.id);
  };

  const handleCloseCreation = () => {
    setCreationState({ isOpen: false, name: '', selectedRecipes: {} });
  };

  const handleRemoveCustomCollection = (collectionId: string) => {
    setCustomCollections((prev) => prev.filter((collection) => collection.id !== collectionId));

    if (selectedCollectionId === collectionId) {
      const nextCollection = collections.find((collection) => collection.id !== collectionId);
      setSelectedCollectionId(nextCollection ? nextCollection.id : '');
    }
  };

  const renderCover = (collection: SavedCollection) => {
    const firstRecipe = collection.recipeIds
      .map((id) => favorites.find((recipe) => recipe.id === id))
      .find((recipe) => Boolean(recipe));

    const coverStyle = firstRecipe?.coverImage
      ? { backgroundImage: `url(${firstRecipe.coverImage})` }
      : { backgroundImage: FALLBACK_COVER };

    return <div className="saved-collections__card-cover" style={coverStyle} aria-hidden="true" />;
  };

  if (!favorites.length) {
    return (
      <div className="saved-collections saved-collections--empty">
        <div className="saved-collections__empty-card">
          <h2>Sem favoritos ainda</h2>
          <p>Adicione receitas aos favoritos para organizar suas playlists aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-collections">
      <header className="saved-collections__header">
        <div>
          <p className="saved-collections__eyebrow">Suas playlists</p>
          <h1>Salvos</h1>
        </div>
        <button type="button" className="saved-collections__create" onClick={handleOpenCreation}>
          <span aria-hidden="true">＋</span>
          Nova playlist
        </button>
      </header>

      <div className="saved-collections__grid" role="list">
        {collections.map((collection) => {
          const isActive = collection.id === selectedCollectionId;
          return (
            <button
              key={collection.id}
              type="button"
              role="listitem"
              className={`saved-collections__card${isActive ? ' is-active' : ''}`}
              onClick={() => setSelectedCollectionId(collection.id)}
            >
              <div className="saved-collections__card-media">
                {renderCover(collection)}
                <div className="saved-collections__card-overlay" aria-hidden="true" />
                <span className="saved-collections__card-count">{collection.recipeIds.length} receitas</span>
              </div>
              <span className="saved-collections__card-name">{collection.name}</span>
            </button>
          );
        })}
      </div>

      {selectedCollection ? (
        <section className="saved-collections__detail">
          <header className="saved-collections__detail-header">
            <div>
              <h2>{selectedCollection.name}</h2>
              <p className="text-muted">
                {selectedCollection.recipeIds.length}{' '}
                {selectedCollection.recipeIds.length === 1 ? 'receita' : 'receitas'} nesta playlist
              </p>
            </div>
            {selectedCollection.type === 'custom' ? (
              <button
                type="button"
                className="saved-collections__delete"
                onClick={() => handleRemoveCustomCollection(selectedCollection.id)}
              >
                Remover playlist
              </button>
            ) : null}
          </header>

          <RecipeGrid
            recipes={selectedRecipes}
            onOpenRecipe={onOpenRecipe}
            onToggleFavorite={onToggleFavorite}
            emptyMessage="Esta playlist ainda nao possui receitas."
          />
        </section>
      ) : null}

      {creationState.isOpen ? (
        <div className="saved-collections__modal" role="dialog" aria-modal="true" aria-labelledby="saved-collections-create-title">
          <div className="saved-collections__modal-content">
            <header className="saved-collections__modal-header">
              <h2 id="saved-collections-create-title">Nova playlist</h2>
              <button type="button" onClick={handleCloseCreation} aria-label="Fechar">
                ×
              </button>
            </header>
            <form className="saved-collections__modal-form" onSubmit={handleCreateCollection}>
              <label className="saved-collections__modal-field">
                <span>Nome da playlist</span>
                <input
                  type="text"
                  value={creationState.name}
                  onChange={(event) =>
                    setCreationState((prev) => ({ ...prev, name: event.target.value, error: undefined }))
                  }
                  placeholder="Ex: Receitas rápidas"
                  autoFocus
                  required
                />
              </label>

              <fieldset className="saved-collections__modal-field">
                <legend>Escolha as receitas favoritas</legend>
                <div className="saved-collections__modal-recipes">
                  {favorites.map((recipe) => (
                    <label key={recipe.id} className="saved-collections__modal-recipe">
                      <input
                        type="checkbox"
                        checked={Boolean(creationState.selectedRecipes[recipe.id])}
                        onChange={() => handleToggleSelection(recipe.id)}
                      />
                      <span>{recipe.title}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {creationState.error ? (
                <p className="saved-collections__modal-error">{creationState.error}</p>
              ) : null}

              <footer className="saved-collections__modal-actions">
                <button type="button" onClick={handleCloseCreation} className="saved-collections__cancel">
                  Cancelar
                </button>
                <button type="submit" className="saved-collections__confirm">
                  Criar playlist
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SavedCollectionsView;
