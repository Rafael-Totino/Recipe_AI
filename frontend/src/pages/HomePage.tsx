import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import RecipeGrid from '../components/recipes/RecipeGrid';
import { useRecipes } from '../context/RecipeContext';
import './home.css';

const inspirationCapsules = [
  { label: 'Jantar Rápido', query: 'jantar rapido', helper: 'Até 30 minutos', icon: '⚡' },
  { label: 'Comfort Food', query: 'comfort', helper: 'Aconchego imediato', icon: '🍲' },
  { label: 'Ingredientes da Estação', query: 'estacao', helper: 'Sabores frescos', icon: '🌿' },
  { label: 'Sem Glúten', query: 'sem gluten', helper: 'Opções leves', icon: '🌾' },
];

const HomePage = () => {
  const { recipes, toggleFavorite, isLoading } = useRecipes();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.toLowerCase().trim() ?? '';

  const filteredRecipes = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => {
      const dateA = a.updatedAt ?? a.createdAt ?? '';
      const dateB = b.updatedAt ?? b.createdAt ?? '';
      return dateB.localeCompare(dateA);
    });

    if (!query) {
      return sorted;
    }

    return sorted.filter((recipe) => {
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
  }, [query, recipes]);

  const favorites = useMemo(
    () => recipes.filter((recipe) => recipe.isFavorite),
    [recipes]
  );

  const averageDuration = useMemo(() => {
    if (!recipes.length) return 0;
    const totalDuration = recipes.reduce((acc, recipe) => acc + (recipe.durationMinutes ?? 0), 0);
    return Math.round(totalDuration / recipes.length);
  }, [recipes]);

  const handleCapsuleSelect = (nextQuery: string) => {
    if (!nextQuery) {
      searchParams.delete('q');
      setSearchParams(searchParams, { replace: true });
      return;
    }
    searchParams.set('q', nextQuery);
    setSearchParams(searchParams, { replace: true });
  };

  if (isLoading && recipes.length === 0) {
    return (
      <div className="atelier" role="status">
        <section className="surface-card atelier__loader">
          <Loader />
          <p>Organizando seu atelier...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="atelier">
      <section className="surface-card atelier__welcome">
        <header className="atelier__welcome-header">
          <div>
            <span className="eyebrow">Meu Atelier</span>
            <h2 className="font-playfair">Curadoria viva para suas criações</h2>
            <p className="text-muted">
              Explore ideias recém-importadas, releituras favoritas e sugestões da IA. Escolha uma cápsula
              para que o atelier reorganize o feed para você.
            </p>
          </div>
          <dl className="atelier__stats" aria-label="Indicadores rápidos">
            <div>
              <dt>Receitas</dt>
              <dd>{recipes.length}</dd>
              <span>no atelier</span>
            </div>
            <div>
              <dt>Favoritas</dt>
              <dd>{favorites.length}</dd>
              <span>queridinhas da casa</span>
            </div>
            <div>
              <dt>Tempo médio</dt>
              <dd>{averageDuration} min</dd>
              <span>para planejar o menu</span>
            </div>
          </dl>
        </header>

        <div className="atelier__capsules" role="list">
          {inspirationCapsules.map((capsule) => {
            const isActive = query === capsule.query;
            return (
              <button
                key={capsule.label}
                type="button"
                role="listitem"
                className={`atelier__capsule${isActive ? ' is-active' : ''}`}
                onClick={() => handleCapsuleSelect(isActive ? '' : capsule.query)}
              >
                <span aria-hidden="true" className="atelier__capsule-icon">{capsule.icon}</span>
                <span>
                  <strong>{capsule.label}</strong>
                  <small>{capsule.helper}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="atelier__feed" aria-live="polite">
        <header className="atelier__feed-header">
          <h3 className="font-playfair">
            {query ? `Explorando "${query}"` : 'Linha do tempo das suas receitas'}
          </h3>
          <p className="text-muted">
            {query
              ? 'Resultados refinados de acordo com o filtro escolhido.'
              : 'Uma seleção cronológica entre o calor da cozinha e a precisão da IA.'}
          </p>
        </header>

        <RecipeGrid
          recipes={filteredRecipes}
          onOpenRecipe={(id) => navigate(`/app/recipes/${id}`)}
          onToggleFavorite={toggleFavorite}
          emptyMessage={
            query
              ? 'Sem correspondências para este filtro. Que tal tentar outra cápsula?'
              : 'Importe sua primeira receita para ativar o atelier.'
          }
        />
      </section>

      <button
        type="button"
        className="fab"
        aria-label="Adicionar nova receita"
        onClick={() => navigate('/app/import')}
      >
        +
      </button>
    </div>
  );
};

export default HomePage;
