import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import RecipeGrid from '../components/recipes/RecipeGrid';
import Loader from '../components/shared/Loader';
import { usePlaylists } from '../context/PlaylistContext';
import { useRecipes } from '../context/RecipeContext';
import type { PlaylistDetail } from '../types';

import './playlists.css';

const FALLBACK_COVER =
  'linear-gradient(135deg, rgba(20, 20, 20, 0.9), rgba(54, 54, 54, 0.9)), url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=60)';

const PlaylistDetailPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { fetchPlaylistDetail, playlists, loadPlaylists } = usePlaylists();
  const { toggleFavorite } = useRecipes();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playlists.length) {
      void loadPlaylists();
    }
  }, [loadPlaylists, playlists.length]);

  useEffect(() => {
    if (!playlistId) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const loadDetail = async () => {
      try {
        const data = await fetchPlaylistDetail(playlistId);
        if (!data) {
          setError('Playlist não encontrada.');
          setDetail(null);
          return;
        }
        setDetail(data);
      } catch (err) {
        console.error('Unable to load playlist detail', err);
        setError('Não foi possível carregar esta playlist. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadDetail();
  }, [fetchPlaylistDetail, playlistId]);

  const recipes = useMemo(() => detail?.items.map((item) => item.recipe) ?? [], [detail?.items]);

  const coverImage = useMemo(() => {
    if (!detail?.items.length) {
      return FALLBACK_COVER;
    }
    const firstWithCover = detail.items.find((item) => item.recipe.coverImage);
    if (firstWithCover?.recipe.coverImage) {
      return `linear-gradient(180deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.85)), url(${firstWithCover.recipe.coverImage})`;
    }
    return FALLBACK_COVER;
  }, [detail?.items]);

  const handleToggleFavorite = async (recipeId: string) => {
    await toggleFavorite(recipeId);
    setDetail((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.recipe.id === recipeId
            ? { ...item, recipe: { ...item.recipe, isFavorite: !item.recipe.isFavorite } }
            : item
        )
      };
    });
    void loadPlaylists();
  };

  return (
    <div className="playlist-detail">
      <header className="playlist-detail__hero" style={{ backgroundImage: coverImage }}>
        <div className="playlist-detail__hero-overlay" aria-hidden="true" />
        <button type="button" className="playlist-detail__back" onClick={() => navigate(-1)}>
          Voltar
        </button>
        <div className="playlist-detail__hero-content">
          <p className="playlist-detail__eyebrow">Coleção</p>
          <h1>{detail?.name ?? 'Playlist'}</h1>
          {detail ? (
            <p className="playlist-detail__meta">
              {detail.recipeCount === 1
                ? '1 receita salva'
                : `${detail.recipeCount} receitas salvas`}
            </p>
          ) : null}
          {detail?.description ? <p className="playlist-detail__description">{detail.description}</p> : null}
        </div>
      </header>

      <div className="playlist-detail__body">
        <nav className="playlist-detail__breadcrumbs" aria-label="Você está em">
          <Link to="/app/playlists">Salvos</Link>
          {detail ? <span aria-current="page">{detail.name}</span> : null}
        </nav>

        {isLoading ? (
          <section className="playlist-detail__loading" role="status">
            <Loader />
            <p>Buscando receitas desta playlist...</p>
          </section>
        ) : null}

        {error && !isLoading ? (
          <section className="playlist-detail__error" role="alert">
            <h2>Ops!</h2>
            <p>{error}</p>
          </section>
        ) : null}

        {!isLoading && !error ? (
          <RecipeGrid
            recipes={recipes}
            onOpenRecipe={(id) => navigate(`/app/recipes/${id}`)}
            onToggleFavorite={handleToggleFavorite}
            emptyMessage="Esta playlist ainda não possui receitas."
          />
        ) : null}
      </div>
    </div>
  );
};

export default PlaylistDetailPage;
