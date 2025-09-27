import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import RecipeGrid from '../components/recipes/RecipeGrid';
import { useRecipes } from '../context/RecipeContext';
import './home.css';

const HomePage = () => {
  const { recipes, toggleFavorite, isLoading } = useRecipes();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.toLowerCase().trim() ?? '';

  const filteredRecipes = useMemo(() => {
    if (!query) {
      return recipes;
    }
    return recipes.filter((recipe) => {
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

  const favorites = filteredRecipes.filter((recipe) => recipe.isFavorite);
  const latest = filteredRecipes.slice(0, 6);

  const totalDuration = useMemo(
    () =>
      recipes.reduce((acc, recipe) => acc + (recipe.durationMinutes ?? 0), 0),
    [recipes]
  );

  const averageDuration = recipes.length ? Math.round(totalDuration / recipes.length) : 0;

  if (isLoading && recipes.length === 0) {
    return (
      <div className="home-page home-page--loading">
        <section className="surface-card home-page__loader">
          <Loader />
          <p>Carregando suas receitas...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="home-page">
      <section className="home-hero surface-card">
        <div className="home-hero__content">
          <span className="eyebrow">Livro digital com IA</span>
          <h2>Seu caderno de receitas com um co-piloto inteligente</h2>
          <p>
            Chef IA memoriza suas preferencias, organiza ingredientes e sugere novas ideias com a mesma
            praticidade de um app comercial, mas feito sob medida para a sua cozinha.
          </p>
          <div className="home-hero__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => navigate('/app/import')}
            >
              Importar receita
            </button>
            <a className="button button--ghost" href="#chat">
              Conversar com Chef IA
            </a>
          </div>
        </div>
        <dl className="home-hero__stats">
          <div>
            <dt>Receitas ativas</dt>
            <dd>{recipes.length}</dd>
            <span className="text-muted">Organizadas e sempre a um toque</span>
          </div>
          <div>
            <dt>Favoritas</dt>
            <dd>{favorites.length}</dd>
            <span className="text-muted">Chef IA aprende o que voce ama</span>
          </div>
          <div>
            <dt>Tempo medio</dt>
            <dd>{averageDuration} min</dd>
            <span className="text-muted">Para planejar melhor o dia</span>
          </div>
        </dl>
      </section>

      <section className="home-section surface-card">
        <div className="home-section__header">
          <div>
            <h3>Favoritas do momento</h3>
            <p className="text-muted">
              Receitas que voce e Chef IA revisitam com frequencia.
            </p>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => navigate('/app/import')}
          >
            Nova importacao
          </button>
        </div>
        <RecipeGrid
          recipes={favorites}
          onOpenRecipe={(id) => navigate(`/app/recipes/${id}`)}
          onToggleFavorite={toggleFavorite}
          emptyMessage={
            query
              ? 'Nenhuma favorita encontrada para essa busca.'
              : 'Marque receitas como favoritas para mante-las aqui por perto.'
          }
        />
      </section>

      <section className="home-section surface-card">
        <div className="home-section__header">
          <div>
            <h3>Novidades na sua cozinha</h3>
            <p className="text-muted">
              Ultimas receitas importadas e ideias fresquinhas do assistente.
            </p>
          </div>
          <a className="button button--ghost" href="#chat">
            Pedir sugestao
          </a>
        </div>
        <RecipeGrid
          recipes={latest}
          onOpenRecipe={(id) => navigate(`/app/recipes/${id}`)}
          onToggleFavorite={toggleFavorite}
          emptyMessage={
            query
              ? 'Nenhuma receita corresponde a busca.'
              : 'Importe uma receita e veja a IA organizar tudo por aqui.'
          }
        />
      </section>
    </div>
  );
};

export default HomePage;
