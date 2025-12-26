import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Loader as LoaderIcon, Plus, Sparkles } from 'lucide-react';

import Loader from '../components/shared/Loader';
import { useAuth } from '../context/AuthContext';
import { useRecipes } from '../context/RecipeContext';
import type { Recipe } from '../types';
import './home.css';

const FALLBACK_COVER = 'linear-gradient(135deg, rgba(155, 89, 182, 0.32), rgba(232, 93, 4, 0.32)), url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=60)';

const buildMeta = (recipe: Recipe) => {
  if (recipe.durationMinutes) {
    return `${recipe.durationMinutes} min`;
  }
  return recipe.source?.importedFrom ? recipe.source.importedFrom : 'Atelier';
};

const HomePage = () => {
  const { user } = useAuth();
  const { recipes, toggleFavorite, isLoading, importRecipe } = useRecipes();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.toLowerCase().trim() ?? '';
  const view = searchParams.get('view')?.toLowerCase().trim() ?? '';

  const sortedRecipes = useMemo(
    () =>
      [...recipes].sort((a, b) => {
        const dateA = a.updatedAt ?? a.createdAt ?? '';
        const dateB = b.updatedAt ?? b.createdAt ?? '';
        return dateB.localeCompare(dateA);
      }),
    [recipes]
  );

  const savedCarousel = useMemo(
    () => sortedRecipes.slice(0, Math.min(sortedRecipes.length, 10)),
    [sortedRecipes]
  );

  const favoritesCarousel = useMemo(
    () => sortedRecipes.filter((recipe) => recipe.isFavorite),
    [sortedRecipes]
  );

  const trendingCarousel = useMemo(() => {
    const pool = sortedRecipes.filter((recipe) => !recipe.isFavorite);
    return pool.slice(0, Math.min(pool.length, 10));
  }, [sortedRecipes]);

  const firstName = user?.name?.split(' ')[0] ?? 'Chef';

  const [importUrl, setImportUrl] = useState('');
  const [importStatus, setImportStatus] = useState<
    | { type: 'idle'; message: string }
    | { type: 'success'; message: string }
    | { type: 'error'; message: string }
    | null
  >(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleQuickImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = importUrl.trim();

    if (!trimmedUrl) {
      setImportStatus({ type: 'error', message: 'Link inválido' });
      return;
    }

    setIsImporting(true);
    setImportStatus({ type: 'idle', message: 'Importando...' });

    const result = await importRecipe(trimmedUrl);

    if (result?.recipe) {
      setImportStatus({ type: 'success', message: 'Importado! Abrindo...' });
      setImportUrl('');
      window.setTimeout(() => {
        navigate(`/app/recipes/${result.recipe.id}`);
      }, 350);
    } else {
      setImportStatus({ type: 'error', message: 'Erro ao importar.' });
    }

    setIsImporting(false);
  };

  const feedBadge = useMemo(() => {
    if (query) return `Filtro: "${query}"`;
    if (view === 'favorites') return 'Somente favoritas';
    if (view === 'explore') return 'Sugestões';
    return '';
  }, [query, view]);

  const renderCarousel = (
    title: string,
    items: Recipe[],
    options: { ariaLabel?: string; showFavoriteToggle?: boolean } = {}
  ) => {
    if (!items.length) return null;

    const ariaLabel = options.ariaLabel ?? title;

    return (
      <section className="timeline__carousel" aria-label={ariaLabel}>
        <header className="timeline__carousel-header">
          <h2>{title}</h2>
        </header>
        <ul className="timeline__carousel-track">
          {items.map((recipe) => {
            const coverStyle = recipe.coverImage
              ? { backgroundImage: `url(${recipe.coverImage})` }
              : { backgroundImage: FALLBACK_COVER };

            return (
              <li key={recipe.id} className="timeline__carousel-item">
                <button
                  type="button"
                  className="timeline__carousel-card"
                  style={coverStyle}
                  onClick={() => navigate(`/app/recipes/${recipe.id}`)}
                >
                  <span className="timeline__carousel-card-overlay" aria-hidden="true" />
                  <span className="timeline__carousel-card-title">{recipe.title}</span>
                  <span className="timeline__carousel-card-meta">{buildMeta(recipe)}</span>
                </button>
                {options.showFavoriteToggle ? (
                  <button
                    type="button"
                    className={`timeline__carousel-favorite${recipe.isFavorite ? ' is-active' : ''}`}
                    onClick={() => toggleFavorite(recipe.id)}
                    aria-pressed={recipe.isFavorite}
                    aria-label={
                      recipe.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
                    }
                  >
                    <Heart
                      size={20}
                      className={recipe.isFavorite ? 'fill-current' : ''}
                      strokeWidth={recipe.isFavorite ? 0 : 2.5}
                    />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  if (isLoading && recipes.length === 0) {
    return (
      <div className="timeline" role="status">
        <section className="surface-card timeline__loader">
          <Loader />
          <p>Preparando a cozinha...</p>
        </section>
      </div>
    );
  }

  if (view === 'favorites') {
    return <Navigate to="/app/playlists" replace />;
  }

  return (
    <div className="timeline">
      <section className="timeline__import" aria-labelledby="timeline-import-title">
        <div className="timeline__import-header">
          <div className="timeline__import-header-title">
            <Sparkles className="timeline__import-icon" size={20} />
            <h1 id="timeline-import-title">Nova Receita</h1>
          </div>
          <p>Cole o link a mágica acontece, {firstName}.</p>
          {feedBadge ? <span className="timeline__badge">{feedBadge}</span> : null}
        </div>
        <form className="timeline__import-form" onSubmit={handleQuickImport} aria-busy={isImporting}>
          <div className="timeline__import-field">
            <input
              type="url"
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="Cole o link aqui..."
              aria-label="Link da receita"
              required
              disabled={isImporting}
            />
            <button type="submit" disabled={isImporting} aria-label="Importar">
              {isImporting ? <LoaderIcon className="animate-spin" size={20} /> : <Plus size={24} />}
            </button>
          </div>
          {importStatus ? (
            <p className={`timeline__import-status timeline__import-status--${importStatus.type}`}>
              {importStatus.message}
            </p>
          ) : null}
        </form>
      </section>

      {renderCarousel('Recentes', savedCarousel, {
        ariaLabel: 'Receitas recentes',
        showFavoriteToggle: true,
      })}

      {renderCarousel('Favoritos', favoritesCarousel, {
        ariaLabel: 'Receitas favoritas',
        showFavoriteToggle: true,
      })}

      {renderCarousel('Em alta', trendingCarousel, { ariaLabel: 'Receitas em alta' })}
    </div>
  );
};

export default HomePage;

