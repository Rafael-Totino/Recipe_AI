import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import { usePlaylists } from '../context/PlaylistContext';
import { useRecipes } from '../context/RecipeContext';
import type { PlaylistSummary } from '../types';
import { getGradientFromSeed } from '../utils/gradients';

import './playlists.css';

const buildPreviewCells = (covers: string[], seed: string) => {
  const normalized = covers.slice(0, 4);
  while (normalized.length < 4) {
    normalized.push('');
  }
  return normalized.map((cover, index) => ({
    id: `${seed}-${index}`,
    style: cover ? { backgroundImage: `url(${cover})` } : { backgroundImage: getGradientFromSeed(`${seed}-${index}`, index) }
  }));
};

const formatCount = (count: number) => {
  if (count === 1) {
    return '1 receita';
  }
  return `${count} receitas`;
};

const PlaylistsPage = () => {
  const navigate = useNavigate();
  const { playlists, isLoading, loadPlaylists, createPlaylist, addRecipeToPlaylist } = usePlaylists();
  const { recipes } = useRecipes();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistNotes, setPlaylistNotes] = useState('');
  const [selectedRecipes, setSelectedRecipes] = useState<Record<string, boolean>>({});
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!playlists.length) {
      void loadPlaylists();
    }
  }, [loadPlaylists, playlists.length]);

  const favoriteRecipes = useMemo(() => recipes.filter((recipe) => recipe.isFavorite), [recipes]);

  const savedRecipesCount = recipes.length;
  const favoriteRecipesCount = favoriteRecipes.length;

  const recipeCountsByPlaylist = useMemo(() => {
    return playlists.reduce<Record<string, number>>((acc, playlist) => {
      if (playlist.slug === 'all-favorites') {
        acc[playlist.id] = favoriteRecipesCount;
        return acc;
      }
      if (playlist.slug === 'all-saved') {
        acc[playlist.id] = savedRecipesCount;
        return acc;
      }
      acc[playlist.id] = playlist.recipeCount ?? 0;
      return acc;
    }, {});
  }, [favoriteRecipesCount, playlists, savedRecipesCount]);

  const totalRecipes = savedRecipesCount;

  const openCreateModal = useCallback(() => {
    setPlaylistName('');
    setPlaylistNotes('');
    setCreationError(null);
    setSelectedRecipes(
      favoriteRecipes.reduce<Record<string, boolean>>((acc, recipe) => {
        acc[recipe.id] = true;
        return acc;
      }, {})
    );
    setIsCreateModalOpen(true);
  }, [favoriteRecipes]);

  useEffect(() => {
    if (!isCreateModalOpen) {
      return;
    }
    setSelectedRecipes((prev) =>
      favoriteRecipes.reduce<Record<string, boolean>>((acc, recipe) => {
        acc[recipe.id] = prev[recipe.id] ?? true;
        return acc;
      }, {})
    );
  }, [favoriteRecipes, isCreateModalOpen]);

  const closeCreateModal = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setIsCreateModalOpen(false);
  }, [isSubmitting]);

  const toggleRecipeSelection = useCallback((recipeId: string) => {
    setSelectedRecipes((prev) => ({
      ...prev,
      [recipeId]: !prev[recipeId]
    }));
    setCreationError(null);
  }, []);

  const handleCreatePlaylist = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) {
        return;
      }

      const trimmedName = playlistName.trim();
      const trimmedNotes = playlistNotes.trim();
      if (!trimmedName) {
        setCreationError('Informe um nome para a playlist.');
        return;
      }

      const recipeIds = favoriteRecipes
        .filter((recipe) => selectedRecipes[recipe.id])
        .map((recipe) => recipe.id);

      if (!recipeIds.length) {
        setCreationError('Selecione ao menos uma receita salva.');
        return;
      }

      setIsSubmitting(true);
      setCreationError(null);

      try {
        const created = await createPlaylist({
          name: trimmedName,
          description: trimmedNotes || undefined
        });

        if (!created) {
          setCreationError('Não foi possível criar a playlist. Tente novamente.');
          return;
        }

        for (const recipeId of recipeIds) {
          await addRecipeToPlaylist(created.id, recipeId);
        }

        setIsCreateModalOpen(false);
      } catch (error) {
        console.error('Unable to create playlist with recipes', error);
        setCreationError('Ocorreu um erro ao criar a playlist. Tente novamente.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      addRecipeToPlaylist,
      createPlaylist,
      favoriteRecipes,
      isSubmitting,
      playlistName,
      playlistNotes,
      selectedRecipes
    ]
  );

  return (
    <div className="playlists-page">
      <header className="playlists-page__header">
        <div>
          <h1>Livros de Receita</h1>
          <p className="playlists-page__subtitle">
            Organize suas receitas favoritas em playlists temáticas e acesse tudo em um só lugar.
          </p>
        </div>
        <div className="playlists-page__meta">
          <div className="playlists-page__stats" aria-label="Resumo das playlists">
            <span>
              {playlists.length}
              <small>playlists</small>
            </span>
            <span>
              {totalRecipes}
              <small>receitas</small>
            </span>
          </div>
          <button
            type="button"
            className="playlists-page__add"
            onClick={openCreateModal}
            aria-label="Criar nova playlist"
          >
            <span aria-hidden="true">＋</span>
          </button>
        </div>
      </header>

      {isLoading ? (
        <section className="playlists-page__loading" role="status">
          <Loader />
          <p>Carregando suas playlists...</p>
        </section>
      ) : null}

      {!isLoading && playlists.length === 0 ? (
        <section className="playlists-page__empty">
          <h2>Nenhuma playlist por aqui ainda</h2>
          <p>As playlists serão criadas automaticamente conforme você salvar receitas favoritas.</p>
        </section>
      ) : null}

      <div className="playlists-page__grid" role="list">
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            recipeCount={recipeCountsByPlaylist[playlist.id] ?? playlist.recipeCount ?? 0}
            onClick={() => navigate(`/app/playlists/${playlist.id}`)}
          />
        ))}
      </div>

      {isCreateModalOpen ? (
        <div
          className="playlists-create-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlists-create-title"
        >
          <div className="playlists-create-modal__panel">
            <header className="playlists-create-modal__header">
              <h2 id="playlists-create-title">Nova playlist</h2>
              <button
                type="button"
                className="playlists-create-modal__close"
                onClick={closeCreateModal}
                aria-label="Fechar"
                disabled={isSubmitting}
              >
                ×
              </button>
            </header>
            <form className="playlists-create-modal__form" onSubmit={handleCreatePlaylist}>
              <label className="playlists-create-modal__field">
                <span>Nome da playlist</span>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(event) => {
                    setPlaylistName(event.target.value);
                    setCreationError(null);
                  }}
                  placeholder="Ex: Segundas sem carne"
                  required
                  autoFocus
                />
              </label>

              <label className="playlists-create-modal__field">
                <span>Observações (opcional)</span>
                <textarea
                  value={playlistNotes}
                  onChange={(event) => {
                    setPlaylistNotes(event.target.value);
                    setCreationError(null);
                  }}
                  placeholder="Inclua dicas, substituições ou harmonizações."
                  rows={3}
                />
              </label>

              <fieldset className="playlists-create-modal__field">
                <legend>Selecione as receitas salvas</legend>
                {favoriteRecipes.length ? (
                  <div className="playlists-create-modal__recipes">
                    {favoriteRecipes.map((recipe) => (
                      <label key={recipe.id} className="playlists-create-modal__recipe">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedRecipes[recipe.id])}
                          onChange={() => toggleRecipeSelection(recipe.id)}
                        />
                        <span>{recipe.title}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="playlists-create-modal__empty">Você ainda não salvou receitas favoritas.</p>
                )}
              </fieldset>

              {creationError ? (
                <p className="playlists-create-modal__error">{creationError}</p>
              ) : null}

              <footer className="playlists-create-modal__actions">
                <button
                  type="button"
                  className="playlists-create-modal__button playlists-create-modal__button--secondary"
                  onClick={closeCreateModal}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="playlists-create-modal__button"
                  disabled={isSubmitting || favoriteRecipes.length === 0}
                >
                  {isSubmitting ? 'Criando...' : 'Criar playlist'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const PlaylistCard = ({
  playlist,
  recipeCount,
  onClick
}: {
  playlist: PlaylistSummary;
  recipeCount: number;
  onClick: () => void;
}) => {
  const { playlistPreviews, getPlaylistPreview } = usePlaylists();

  useEffect(() => {
    if (!playlistPreviews[playlist.id]) {
      void getPlaylistPreview(playlist.id);
    }
  }, [getPlaylistPreview, playlist.id, playlistPreviews]);

  const covers = playlistPreviews[playlist.id] ?? [];
  const hasAtLeastOneCover = covers.some((cover) => Boolean(cover));
  const previewCells = buildPreviewCells(covers, playlist.id);

  return (
    <button type="button" role="listitem" className="playlists-card" onClick={onClick}>
      <div
        className={`playlists-card__cover${hasAtLeastOneCover ? ' has-preview' : ''}`}
        style={hasAtLeastOneCover ? undefined : { backgroundImage: getGradientFromSeed(playlist.id) }}
        aria-hidden="true"
      >
        {hasAtLeastOneCover ? (
          <div className="playlists-card__cover-grid">
            {previewCells.map((cell) => (
              <span key={cell.id} className="playlists-card__cover-cell" style={cell.style} />
            ))}
          </div>
        ) : (
          <span className="playlists-card__initials">{playlist.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="playlists-card__content">
        <p className="playlists-card__name">{playlist.name}</p>
        <p className="playlists-card__meta">{formatCount(recipeCount)}</p>
      </div>
    </button>
  );
};

export default PlaylistsPage;
