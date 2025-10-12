import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
  const { fetchPlaylistDetail, playlists, loadPlaylists, deletePlaylist, updatePlaylist } = usePlaylists();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

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

  const recipeCount = detail?.recipeCount ?? detail?.items.length ?? 0;

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleDeletePlaylist = async () => {
    if (!detail) {
      return;
    }
    const confirmation = window.confirm('Tem certeza que deseja excluir esta playlist? Esta ação não pode ser desfeita.');
    if (!confirmation) {
      return;
    }
    await deletePlaylist(detail.id);
    navigate('/app/playlists');
    setIsMenuOpen(false);
  };

  const handleEditPlaylist = async () => {
    if (!detail) {
      return;
    }

    const newName = window.prompt('Editar nome da playlist', detail.name)?.trim();
    if (!newName) {
      return;
    }

    const newDescription = window.prompt('Editar descrição da playlist (opcional)', detail.description ?? '')?.trim();

    const updated = await updatePlaylist(detail.id, {
      name: newName,
      description: newDescription === '' ? null : newDescription
    });

    if (updated) {
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    }
    setIsMenuOpen(false);
  };

  const handleSharePlaylist = async (access: 'read' | 'edit') => {
    if (!detail) {
      return;
    }

    const modeLabel = access === 'edit' ? 'edição' : 'leitura';
    const shareUrl = `${window.location.origin}/app/playlists/${detail.id}?permissao=${access}`;
    const shareData = {
      title: `Playlist ${detail.name}`,
      text: `Confira minha playlist culinária com acesso de ${modeLabel}.`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Link de compartilhamento copiado para a área de transferência!');
      }
    } catch (shareError) {
      console.error('Unable to share playlist', shareError);
      alert('Não foi possível compartilhar a playlist. Tente novamente.');
    } finally {
      setIsMenuOpen(false);
    }
  };

  const handleAddRecipe = () => {
    if (!detail) {
      return;
    }
    navigate(`/app?adicionar-a-playlist=${detail.id}`);
  };

  return (
    <div className="playlist-detail">
      <header className="playlist-detail__hero" style={{ backgroundImage: coverImage }}>
        <div className="playlist-detail__hero-overlay" aria-hidden="true" />
        <div className="playlist-detail__hero-top">
          <button type="button" className="playlist-detail__back" onClick={() => navigate(-1)}>
            Voltar
          </button>
          <div className="playlist-detail__actions" ref={actionsRef}>
            <button
              type="button"
              className="playlist-detail__actions-trigger"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
              onClick={handleToggleMenu}
            >
              <span className="sr-only">Abrir ações da playlist</span>
              <span aria-hidden="true">⋯</span>
            </button>
            {isMenuOpen ? (
              <div className="playlist-detail__menu" role="menu">
                <button type="button" role="menuitem" onClick={handleEditPlaylist}>
                  Editar informações
                </button>
                <div className="playlist-detail__menu-group" role="group" aria-label="Compartilhar playlist">
                  <span>Compartilhar playlist</span>
                  <button type="button" onClick={() => handleSharePlaylist('read')}>
                    Enviar link de leitura
                  </button>
                  <button type="button" onClick={() => handleSharePlaylist('edit')}>
                    Enviar link com edição
                  </button>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="playlist-detail__menu-delete"
                  onClick={handleDeletePlaylist}
                >
                  Excluir playlist
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="playlist-detail__hero-content">
          <p className="playlist-detail__eyebrow">Playlist</p>
          <h1 className="playlist-detail__title">
            <span>{detail?.name ?? 'Playlist'}</span>
            {detail ? (
              <span className="playlist-detail__count">({recipeCount} {recipeCount === 1 ? 'receita' : 'receitas'})</span>
            ) : null}
          </h1>
          {detail ? (
            <p className="playlist-detail__meta">
              {recipeCount === 1 ? '1 receita salva' : `${recipeCount} receitas salvas`}
            </p>
          ) : null}
          {detail?.description ? <p className="playlist-detail__description">{detail.description}</p> : null}
          <button type="button" className="playlist-detail__add" onClick={handleAddRecipe}>
            + Adicionar nova receita
          </button>
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
