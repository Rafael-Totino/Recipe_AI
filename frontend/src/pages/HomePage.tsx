import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import RecipeGrid from '../components/recipes/RecipeGrid';
import { useAuth } from '../context/AuthContext';
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
  const { recipes, toggleFavorite, isLoading } = useRecipes();
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
                    onClick={() => toggleFavorite(recipe.id)}
                    aria-pressed={recipe.isFavorite}
                    aria-label={
                      recipe.isFavorite ? 'Remover receita dos favoritos' : 'Adicionar receita aos favoritos'
                    }
                  >
                    <span aria-hidden="true">?</span>
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

  return (
    <div className="timeline">
      <section className="timeline__hero">
        <div className="timeline__hero-inner">
          <span className="timeline__hero-eyebrow">{timeOfDay}, {firstName}</span>
          <h1 className="timeline__hero-title">Timeline das suas receitas</h1>
          <p className="timeline__hero-subtitle">
            Uma jornada cronologica para sua culinaria autoral ganhar novas releituras e inspiracoes.
          </p>
          {feedBadge ? <span className="timeline__badge">{feedBadge}</span> : null}
        </div>
      </section>

      {renderCarousel(
        'Receitas salvas',
        'Suas criacoes recentes organizadas em capsulas rapidas.',
        savedCarousel,
        { ariaLabel: 'Receitas salvas recentemente', showFavoriteToggle: true }
      )}

      {renderCarousel(
        'Favoritas do atelier',
        'Os pratos que receberam estrela ficam reunidos aqui.',
        favoritesCarousel,
        { ariaLabel: 'Receitas favoritas', showFavoriteToggle: true }
      )}

      {renderCarousel(
        'Em alta',
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
          onToggleFavorite={toggleFavorite}
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
