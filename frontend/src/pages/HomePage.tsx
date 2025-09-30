import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import RecipeGrid from '../components/recipes/RecipeGrid';
import { useRecipes } from '../context/RecipeContext';
import { useAuth } from '../context/AuthContext';
import './home.css';

const HomePage = () => {
  const { user } = useAuth();
  const { recipes, toggleFavorite, isLoading } = useRecipes();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.toLowerCase().trim() ?? '';
  const view = searchParams.get('view')?.toLowerCase().trim() ?? '';

  const filteredRecipes = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => {
      const dateA = a.updatedAt ?? a.createdAt ?? '';
      const dateB = b.updatedAt ?? b.createdAt ?? '';
      return dateB.localeCompare(dateA);
    });

    let scoped = sorted;

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
  }, [query, recipes, view]);

  const favorites = useMemo(
    () => recipes.filter((recipe) => recipe.isFavorite),
    [recipes]
  );

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
      return 'Explorar novas criações do atelier';
    }
    return 'Linha do tempo das suas receitas';
  }, [query, view]);

  const feedSubtitle = useMemo(() => {
    if (query) {
      return 'Buscamos entre suas criações para encontrar o que combina com o seu pedido.';
    }
    if (view === 'favorites') {
      return 'Somente as receitas marcadas com estrela aparecem por aqui.';
    }
    if (view === 'explore') {
      return 'Descubra sugestões recentes, cápsulas criativas e combinações da IA.';
    }
    return 'Uma seleção cronológica entre o calor da cozinha e a precisão da IA.';
  }, [query, view]);

  const feedBadge = useMemo(() => {
    if (query) {
      return `Filtrando por "${query}"`;
    }
    if (view === 'favorites') {
      return 'Exibindo favoritas';
    }
    if (view === 'explore') {
      return 'Explorando sugestões do atelier';
    }
    return '';
  }, [query, view]);

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
            Uma jornada cronológica para sua culinária autoral ganhar novas releituras e inspirações.
          </p>
          {feedBadge ? <span className="timeline__badge">{feedBadge}</span> : null}
        </div>
      </section>

      {favorites.length ? (
        <section className="timeline__saved" aria-label="Receitas salvas recentemente">
          <header className="timeline__saved-header">
            <h2>Receitas salvas</h2>
            <p className="text-muted">Suas inspirações favoritas sempre ao alcance do toque.</p>
          </header>
          <ul className="timeline__saved-list">
            {favorites.map((recipe) => {
              const coverStyle = recipe.coverImage
                ? { backgroundImage: `url(${recipe.coverImage})` }
                : {
                    backgroundImage:
                      'linear-gradient(135deg, rgba(155, 89, 182, 0.32), rgba(232, 93, 4, 0.32)), url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=60)'
                  };

              return (
                <li key={recipe.id} className="timeline__saved-item">
                  <button
                    type="button"
                    className="timeline__saved-card"
                    style={coverStyle}
                    onClick={() => navigate(`/app/recipes/${recipe.id}`)}
                  >
                    <span className="timeline__saved-card-overlay" aria-hidden="true" />
                    <span className="timeline__saved-card-title">{recipe.title}</span>
                    <span className="timeline__saved-card-meta">
                      {recipe.durationMinutes ? `⏱️ ${recipe.durationMinutes} min` : 'Favorita'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`timeline__saved-favorite${recipe.isFavorite ? ' is-active' : ''}`}
                    onClick={() => toggleFavorite(recipe.id)}
                    aria-pressed={recipe.isFavorite}
                    aria-label={
                      recipe.isFavorite ? 'Remover receita salva dos favoritos' : 'Adicionar receita aos favoritos'
                    }
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
              ? 'Sem correspondências para este filtro. Que tal tentar outro pedido na busca?'
              : view === 'favorites'
              ? 'Você ainda não favoritou nenhuma receita. Marque suas preferidas para vê-las aqui.'
              : 'Importe sua primeira receita para ativar o atelier.'
          }
        />
      </section>
    </div>
  );
};

export default HomePage;
