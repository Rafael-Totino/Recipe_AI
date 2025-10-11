import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import { usePlaylists } from '../context/PlaylistContext';
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
  const { playlists, isLoading, loadPlaylists } = usePlaylists();

  useEffect(() => {
    if (!playlists.length) {
      void loadPlaylists();
    }
  }, [loadPlaylists, playlists.length]);

  const totalRecipes = useMemo(() => {
    const savedPlaylist = playlists.find((playlist) => playlist.id === 'system:all-saved');
    return savedPlaylist?.recipeCount ?? 0;
  }, [playlists]);

  return (
    <div className="playlists-page">
      <header className="playlists-page__header">
        <div>
          <h1>Livros de Receita</h1>
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
          <PlaylistCard key={playlist.id} playlist={playlist} onClick={() => navigate(`/app/playlists/${playlist.id}`)} />
        ))}
      </div>
    </div>
  );
};

const PlaylistCard = ({ playlist, onClick }: { playlist: PlaylistSummary; onClick: () => void }) => {
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
        <p className="playlists-card__meta">{formatCount(playlist.recipeCount)}</p>
      </div>
    </button>
  );
};

export default PlaylistsPage;
