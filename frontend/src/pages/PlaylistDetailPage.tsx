import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import { usePlaylists } from '../context/PlaylistContext';
import type { PlaylistDetail, Recipe } from '../types';
import { getGradientFromSeed } from '../utils/gradients';

import './playlists.css';

const FALLBACK_COVER =
  'linear-gradient(160deg, rgba(58, 44, 104, 0.82), rgba(24, 76, 119, 0.82)), url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=60)';

const PlaylistDetailPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { fetchPlaylistDetail, playlists, loadPlaylists } = usePlaylists();
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

  const coverImage = useMemo(() => {
    if (!detail?.items.length) {
      return FALLBACK_COVER;
    }
    const firstWithCover = detail.items.find((item) => item.recipe.coverImage);
    if (firstWithCover?.recipe.coverImage) {
      return `linear-gradient(180deg, rgba(55, 40, 105, 0.58), rgba(20, 31, 63, 0.9)), url(${firstWithCover.recipe.coverImage})`;
    }
    return FALLBACK_COVER;
  }, [detail?.items]);

  const recipeCards = useMemo(() => {
    if (!detail?.items.length) {
      return [];
    }
    return detail.items.map((item) => item.recipe);
  }, [detail?.items]);

  const getRecipeBackground = (recipe: Recipe, index: number) => {
    if (recipe.coverImage) {
      return { backgroundImage: `url(${recipe.coverImage})` };
    }
    const mediaImage = recipe.media?.find((media) => media.type === 'image');
    if (mediaImage?.thumbnailUrl) {
      return { backgroundImage: `url(${mediaImage.thumbnailUrl})` };
    }
    if (mediaImage?.url) {
      return { backgroundImage: `url(${mediaImage.url})` };
    }
    return { backgroundImage: getGradientFromSeed(`${recipe.id}-${index}`) };
  };

  return (
    <div className="playlist-detail">
      <header className="playlist-detail__hero" style={{ backgroundImage: coverImage }}>
        <div className="playlist-detail__hero-overlay" aria-hidden="true" />
        <div className="playlist-detail__hero-top">
          <button type="button" className="playlist-detail__back" onClick={() => navigate(-1)}>
            Voltar
          </button>
          <nav className="playlist-detail__breadcrumbs" aria-label="Você está em">
            <Link to="/app/playlists">Salvos</Link>
            {detail ? <span aria-current="page">{detail.name}</span> : null}
          </nav>
        </div>
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
          recipeCards.length ? (
            <div className="playlist-detail__recipes" role="list">
              {recipeCards.map((recipe, index) => (
                <button
                  key={recipe.id}
                  type="button"
                  role="listitem"
                  className="playlist-detail__recipe-card"
                  onClick={() => navigate(`/app/recipes/${recipe.id}`)}
                >
                  <span className="sr-only">Abrir receita {recipe.title}</span>
                  <span className="playlist-detail__recipe-thumb" style={getRecipeBackground(recipe, index)} />
                  <span className="playlist-detail__recipe-overlay" aria-hidden="true" />
                  <span className="playlist-detail__recipe-info" aria-hidden="true">
                    <span className="playlist-detail__recipe-name">{recipe.title}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="playlist-detail__empty">Esta playlist ainda não possui receitas.</p>
          )
        ) : null}
      </div>
    </div>
  );
};

export default PlaylistDetailPage;
