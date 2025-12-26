import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChefHat,
  Clock,
  Flame,
  Heart,
  Share2,
  Tag,
  Trash2,
  Users,
  Utensils
} from 'lucide-react';

import RecipePlayer from '../components/recipes/RecipePlayer';
import Loader from '../components/shared/Loader';
import { useRecipes } from '../context/RecipeContext';
import './recipe-detail.css';

const fallbackCover =
  'https://images.unsplash.com/photo-1512058564366-c9e3e046d041?auto=format&fit=crop&w=1400&q=60';

const RecipeDetailPage = () => {
  const { recipeId } = useParams();
  const { activeRecipe, selectRecipe, updateNotes, toggleFavorite, removeRecipe } = useRecipes();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    if (recipeId) {
      void selectRecipe(recipeId);
    }
  }, [recipeId, selectRecipe]);

  useEffect(() => {
    setNotes(activeRecipe?.notes ?? '');
    setCheckedIngredients(new Set());
  }, [activeRecipe?.notes, activeRecipe?.id]);

  useEffect(() => {
    const handleScroll = () => {
      setParallaxOffset(window.scrollY * 0.25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const ingredients = activeRecipe?.ingredients ?? [];
  const steps = useMemo(
    () => (activeRecipe?.steps ?? []).sort((a, b) => a.order - b.order),
    [activeRecipe?.steps]
  );

  if (!activeRecipe) {
    return (
      <div className="surface-card recipe-detail__loader" role="status">
        <Loader />
      </div>
    );
  }

  const handleSaveNotes = async () => {
    if (!recipeId) return;
    setIsSaving(true);
    await updateNotes(recipeId, notes);
    setIsSaving(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: activeRecipe.title,
      text: activeRecipe.description ?? 'Confira esta receita!',
      url: window.location.href
    };

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      alert('Link copiado!');
    }
  };

  const handleDelete = async () => {
    if (!recipeId) return;
    const confirmation = window.confirm('Deseja realmente remover?');
    if (!confirmation) return;
    await removeRecipe(recipeId);
    navigate('/app');
  };

  const toggleIngredient = (key: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const metadata = [
    activeRecipe.durationMinutes ? { label: 'Tempo', value: `${activeRecipe.durationMinutes}m`, icon: <Clock size={16} /> } : null,
    activeRecipe.servings ? { label: 'Porções', value: `${activeRecipe.servings}`, icon: <Users size={16} /> } : null,
    activeRecipe.difficulty ? { label: 'Dificuldade', value: activeRecipe.difficulty, icon: <Flame size={16} /> } : null,
    activeRecipe.tags?.length ? { label: 'Tags', value: activeRecipe.tags.slice(0, 2).join(', '), icon: <Tag size={16} /> } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; icon: JSX.Element }>;

  const heroImage = activeRecipe.coverImage ?? fallbackCover;

  return (
    <div className="recipe-detail">
      <section className="recipe-hero" aria-labelledby="recipe-title">
        <div className="recipe-hero__image" style={{ transform: `translateY(${parallaxOffset * -0.3}px)` }}>
          <img src={heroImage} alt="" />
        </div>
        <div className="recipe-hero__overlay" />
        <div className="recipe-hero__content">
          <h1 id="recipe-title" className="font-playfair">{activeRecipe.title}</h1>
          <p className="recipe-hero__description">{activeRecipe.description}</p>

          <div className="recipe-hero__actions">
            <button
              type="button"
              className="recipe-action recipe-action--primary"
              onClick={() => navigate(`/app/recipes/${activeRecipe.id}/cook`)}
            >
              <span className="recipe-action__icon"><ChefHat size={20} /></span>
              <span className="recipe-action__label">Cozinhar</span>
            </button>
            <button
              type="button"
              className={`recipe-action ${activeRecipe.isFavorite ? 'recipe-action--accent' : 'recipe-action--outline'}`}
              onClick={() => toggleFavorite(activeRecipe.id)}
            >
              <span className="recipe-action__icon">
                <Heart size={20} className={activeRecipe.isFavorite ? 'fill-current' : ''} />
              </span>
              <span className="recipe-action__label">{activeRecipe.isFavorite ? 'Salvo' : 'Salvar'}</span>
            </button>
            <button
              type="button"
              className="recipe-action recipe-action--outline"
              onClick={handleShare}
            >
              <span className="recipe-action__icon"><Share2 size={20} /></span>
              <span className="recipe-action__label">Compartilhar</span>
            </button>
            <button
              type="button"
              className="recipe-action recipe-action--danger"
              onClick={handleDelete}
            >
              <span className="recipe-action__icon"><Trash2 size={20} /></span>
              <span className="recipe-action__label">Remover</span>
            </button>
          </div>
        </div>
      </section>

      {metadata.length ? (
        <section className="recipe-meta" aria-label="Informações">
          {metadata.map((item, i) => (
            <div key={i} className="recipe-meta__card">
              <span className="recipe-meta__icon">{item.icon}</span>
              <div className="recipe-meta__info">
                <strong>{item.value}</strong>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <RecipePlayer media={activeRecipe.media} source={activeRecipe.source} />

      <section className="surface-card recipe-panel">
        <div className="recipe-panel__header">
          <h2 className="font-playfair">Ingredientes</h2>
        </div>
        <ul className="recipe-ingredients">
          {ingredients.map((ingredient) => {
            const key = `${ingredient.name}-${ingredient.quantity ?? ''}`;
            const isChecked = checkedIngredients.has(key);
            return (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleIngredient(key)}
                  />
                  <span>
                    <strong>{ingredient.quantity ? `${ingredient.quantity} ` : ''}</strong>
                    {ingredient.name}
                    {ingredient.notes ? <em> — {ingredient.notes}</em> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="surface-card recipe-panel">
        <div className="recipe-panel__header">
          <h2 className="font-playfair">Preparo</h2>
        </div>
        <ol className="recipe-steps">
          {steps.map((step) => (
            <li key={step.order}>
              <div className="recipe-step__number">{step.order}</div>
              <div className="recipe-step__content">
                <p>{step.description}</p>
                {step.tips ? <span className="recipe-step__tip">Dica: {step.tips}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface-card recipe-panel">
        <div className="recipe-panel__header">
          <h2 className="font-playfair">Notas</h2>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Suas anotações pessoais..."
        />
        <div className="recipe-notes__actions">
          <button type="button" className="button button--primary" onClick={handleSaveNotes} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default RecipeDetailPage;
