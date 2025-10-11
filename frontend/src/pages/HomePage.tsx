import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import RecipeGrid from '../components/recipes/RecipeGrid';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useRecipes } from '../context/RecipeContext';
import type { Recipe } from '../types';
import './home.css';

const FALLBACK_COVER = 'linear-gradient(135deg, rgba(155, 89, 182, 0.32), rgba(232, 93, 4, 0.32)), url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=60)';

const buildMeta = (recipe: Recipe) => {
  if (recipe.durationMinutes) {
    return `${recipe.durationMinutes} min`;
  }
  if (recipe.tags?.length) {
    return recipe.tags.slice(0, 2).join(' • ');
  }
  return recipe.source?.importedFrom ? `Origem: ${recipe.source.importedFrom}` : 'Receita do atelier';
};

const HomePage = () => {
  const { user } = useAuth();
  const { recipes, toggleFavorite, isLoading, importRecipe } = useRecipes();
  const { loadPlaylists } = usePlaylists();
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

  const filteredRecipes = useMemo(() => {
    let scoped = sortedRecipes;

    if (view === 'favorites') {
      scoped = scoped.filter((recipe) => recipe.isFavorite);
    }

    if (!query) {
      return scoped;
    }

    return scoped.filter((recipe) => {
      const haystack = [
        recipe.title,
        recipe.description,
        recipe.tags?.join(' '),
        recipe.ingredients?.map((ingredient) => ingredient.name).join(' ')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [query, sortedRecipes, view]);

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
  const timeOfDay = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

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
      setImportStatus({ type: 'error', message: 'Informe um link válido para importar.' });
      return;
    }

    setIsImporting(true);
    setImportStatus({ type: 'idle', message: 'Importando sua receita...' });

    const result = await importRecipe(trimmedUrl);

    if (result?.recipe) {
      setImportStatus({ type: 'success', message: 'Receita importada! Abrindo detalhes...' });
      setImportUrl('');
      window.setTimeout(() => {
        navigate(`/app/recipes/${result.recipe.id}`);
      }, 350);
    } else {
      setImportStatus({ type: 'error', message: 'Não foi possível importar a receita. Tente outro link.' });
    }

    setIsImporting(false);
  };

  const feedTitle = useMemo(() => {
    if (query) {
      return `Resultados para "${query}"`;
    }
    if (view === 'favorites') {
      return 'Suas receitas favoritas';
    }
    if (view === 'explore') {
      return 'Explorar novas criacoes do atelier';
    }
    return 'Linha do tempo das suas receitas';
  }, [query, view]);

  const feedSubtitle = useMemo(() => {
    if (query) {
      return 'Buscamos entre suas criacoes para encontrar o que combina com o seu pedido.';
    }
    if (view === 'favorites') {
      return 'Somente as receitas marcadas com estrela aparecem por aqui.';
    }
    if (view === 'explore') {
      return 'Descubra sugestoes recentes e combinacoes da IA.';
    }
    return 'Uma selecao cronologica entre o calor da cozinha e a precisao da IA.';
  }, [query, view]);

  const feedBadge = useMemo(() => {
    if (query) {
      return `Filtrando por "${query}"`;
    }
    if (view === 'favorites') {
      return 'Exibindo favoritas';
    }
    if (view === 'explore') {
      return 'Explorando sugestoes do atelier';
    }
    return '';
  }, [query, view]);

  const handleToggleFavorite = useCallback(
    async (recipeId: string) => {
      await toggleFavorite(recipeId);
      void loadPlaylists();
    },
    [loadPlaylists, toggleFavorite]
  );

  const renderCarousel = (
    title: string,
    subtitle: string,
    items: Recipe[],
    options: { ariaLabel?: string; showFavoriteToggle?: boolean } = {}
  ) => {
    if (!items.length) {
      return null;
    }

    const ariaLabel = options.ariaLabel ?? title;

    return (
      <section className="timeline__carousel" aria-label={ariaLabel}>
        <header className="timeline__carousel-header">
          <h2>{title}</h2>
          {subtitle ? <p className="text-muted">{subtitle}</p> : null}
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
                    onClick={() => handleToggleFavorite(recipe.id)}
                    aria-pressed={recipe.isFavorite}
                    aria-label={
                      recipe.isFavorite ? 'Remover receita dos favoritos' : 'Adicionar receita aos favoritos'
                    }
                  >
                    <span aria-hidden="true" className="timeline__carousel-favorite-icon">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path
                          d="M11.646 20.91c-.12-.082-.236-.161-.348-.238a25.006 25.006 0 0 1-3.746-3.102C5.517 15.445 2.75 12.44 2.75 8.75c0-2.9 2.23-5.25 5-5.25 1.701 0 3.217.91 4.25 2.182C13.033 4.41 14.55 3.5 16.25 3.5c2.77 0 5 2.35 5 5.25 0 3.69-2.767 6.695-4.802 8.82a25.006 25.006 0 0 1-3.746 3.102c-.112.077-.228.156-.348.238a.75.75 0 0 1-.908 0Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
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
          <p>Organizando seu atelier...</p>
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
          <span className="timeline__import-eyebrow">{timeOfDay}, {firstName}</span>
          <h1 id="timeline-import-title">Importe uma receita por link</h1>
          <p>
            Cole URLs de blogs, vídeos ou redes sociais para trazer receitas diretamente para o seu atelier digital.
          </p>
          {feedBadge ? <span className="timeline__badge">{feedBadge}</span> : null}
        </div>
        <form className="timeline__import-form" onSubmit={handleQuickImport} aria-busy={isImporting}>
          <div className="timeline__import-field">
            <input
              type="url"
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="https://exemplo.com/minha-receita"
              aria-label="Link da receita para importar"
              required
              disabled={isImporting}
            />
            <button type="submit" disabled={isImporting}>
              {isImporting ? 'Importando...' : 'Importar receita'}
            </button>
          </div>
          {importStatus ? (
            <p className={`timeline__import-status timeline__import-status--${importStatus.type}`}>
              {importStatus.message}
            </p>
          ) : null}
        </form>
      </section>

      {renderCarousel(
        'Receitas salvas recentemente',
        'Suas criacoes mais novas organizadas em cápsulas rápidas.',
        savedCarousel,
        { ariaLabel: 'Receitas salvas recentemente', showFavoriteToggle: true }
      )}

      {renderCarousel(
        'Receitas favoritas',
        'Os pratos que receberam estrela ficam reunidos aqui.',
        favoritesCarousel,
        { ariaLabel: 'Receitas favoritas', showFavoriteToggle: true }
      )}

      {renderCarousel(
        'Receitas em alta',
        'Sugestoes do Chef IA com mais atividade recente.',
        trendingCarousel,
        { ariaLabel: 'Receitas em alta' }
      )}

      <section className="timeline__feed" aria-live="polite">
        <header className="timeline__feed-header">
          <h2>{feedTitle}</h2>
          <p className="text-muted">{feedSubtitle}</p>
        </header>

        <RecipeGrid
          recipes={filteredRecipes}
          onOpenRecipe={(id) => navigate(`/app/recipes/${id}`)}
          onToggleFavorite={handleToggleFavorite}
          emptyMessage={
            query
              ? 'Sem correspondencias para este filtro. Tente outro pedido na busca.'
              : view === 'favorites'
              ? 'Voce ainda nao favoritou nenhuma receita. Marque suas preferidas para ve-las aqui.'
              : 'Importe sua primeira receita para ativar o atelier.'
          }
        />
      </section>
    </div>
  );
};

export default HomePage;
