import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import { usePlaylists } from '../context/PlaylistContext';

import './playlists.css';

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, rgba(255, 99, 132, 0.65), rgba(53, 162, 235, 0.65))',
  'linear-gradient(135deg, rgba(255, 159, 64, 0.65), rgba(75, 192, 192, 0.65))',
  'linear-gradient(135deg, rgba(153, 102, 255, 0.65), rgba(255, 205, 86, 0.65))'
];

const getFallbackBackground = (seed: string) => {
  if (!seed) {
    return FALLBACK_GRADIENTS[0];
  }
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
};

const formatCount = (count: number) => {
  if (count === 1) {
    return '1 receita';
  }
  return `${count} receitas`;
};

const PlaylistsPage = () => {
  const navigate = useNavigate();
  const { playlists, isLoading, loadPlaylists } = usePlaylists();

  useEffect(() => {
    if (!playlists.length) {
      void loadPlaylists();
    }
  }, [loadPlaylists, playlists.length]);

  const totalRecipes = useMemo(
    () => playlists.reduce((acc, playlist) => acc + (playlist.recipeCount ?? 0), 0),
    [playlists]
  );

  return (
    <div className="playlists-page">
      <header className="playlists-page__header">
        <div>
          <p className="playlists-page__eyebrow">Coleção</p>
          <h1>Salvos</h1>
          <p className="playlists-page__subtitle">
            Organize suas receitas favoritas em playlists temáticas e acesse tudo em um só lugar.
          </p>
        </div>
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
          <button
            key={playlist.id}
            type="button"
            role="listitem"
            className="playlists-card"
            onClick={() => navigate(`/app/playlists/${playlist.id}`)}
          >
            <div
              className="playlists-card__cover"
              style={{ backgroundImage: getFallbackBackground(playlist.id) }}
              aria-hidden="true"
            >
              <span className="playlists-card__initials">{playlist.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="playlists-card__content">
              <p className="playlists-card__name">{playlist.name}</p>
              <p className="playlists-card__meta">{formatCount(playlist.recipeCount)}</p>
              {playlist.type === 'system' ? (
                <span className="playlists-card__badge">Playlist padrão</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlaylistsPage;
