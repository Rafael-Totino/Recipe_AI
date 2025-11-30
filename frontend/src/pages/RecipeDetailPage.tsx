import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
    if (!recipeId) {
      return;
    }
    setIsSaving(true);
    await updateNotes(recipeId, notes);
    setIsSaving(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: activeRecipe.title,
      text: activeRecipe.description ?? 'Confira minha receita favorita!',
      url: window.location.href
    };

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      alert('Link copiado para a área de transferência!');
    }
  };

  const handleDelete = async () => {
    if (!recipeId) {
      return;
    }
    const confirmation = window.confirm('Tem certeza que deseja remover esta receita?');
    if (!confirmation) {
      return;
    }
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
    activeRecipe.durationMinutes ? { label: 'Tempo', value: `${activeRecipe.durationMinutes} min`, icon: '⏱' } : null,
    activeRecipe.servings ? { label: 'Porções', value: `${activeRecipe.servings}`, icon: '🍽' } : null,
    activeRecipe.difficulty ? { label: 'Dificuldade', value: activeRecipe.difficulty, icon: '🔥' } : null,
    activeRecipe.tags?.length ? { label: 'Tags', value: activeRecipe.tags.join(', '), icon: '🏷' } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; icon: string }>;

  const heroImage = activeRecipe.coverImage ?? fallbackCover;

  const heroActions: Array<{
    key: string;
    label: string;
    icon: string;
    variant?: 'primary' | 'outline' | 'accent' | 'danger';
    onClick: () => void | Promise<void>;
  }> = [
    {
      key: 'cook',
      label: 'Modo cozinha',
      icon: '🍳',
      variant: 'primary',
      onClick: () => navigate(`/app/recipes/${activeRecipe.id}/cook`)
    },
    {
      key: 'favorite',
      label: activeRecipe.isFavorite ? 'Favorito' : 'Favoritar',
      icon: activeRecipe.isFavorite ? '⭐' : '☆',
      variant: activeRecipe.isFavorite ? 'accent' : 'outline',
      onClick: () => toggleFavorite(activeRecipe.id)
    },
    {
      key: 'share',
      label: 'Compartilhar',
      icon: '🔗',
      variant: 'outline',
      onClick: handleShare
    },
    {
      key: 'remove',
      label: 'Remover',
      icon: '🗑️',
      variant: 'danger',
      onClick: handleDelete
    }
  ];
  return (
    <div className="recipe-detail">
      <section className="recipe-hero" aria-labelledby="recipe-title">
        <div className="recipe-hero__image" style={{ transform: `translateY(${parallaxOffset * -0.3}px)` }}>
          <img src={heroImage} alt="Imagem da receita" />
        </div>
        <div className="recipe-hero__overlay" />
        <div className="recipe-hero__content">
          <h1 id="recipe-title" className="font-playfair">{activeRecipe.title}</h1>
          <p className="recipe-hero__description">{activeRecipe.description}</p>
          <div className="recipe-hero__actions">
            {heroActions.map((action) => {
              const classNames = ['recipe-action'];
              if (action.variant) {
                classNames.push(`recipe-action--${action.variant}`);
              }
              return (
                <button
                  key={action.key}
                  type="button"
                  className={classNames.join(' ')}
                  onClick={action.onClick}
                >
                  <span className="recipe-action__icon" aria-hidden="true">
                    {action.icon}
                  </span>
                  <span className="recipe-action__label">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {metadata.length ? (
        <section className="recipe-meta" aria-label="Informações da receita">
          {metadata.map((item) => (
            <div key={item.label} className="recipe-meta__card">
              <span aria-hidden="true">{item.icon}</span>
              <div>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <RecipePlayer media={activeRecipe.media} source={activeRecipe.source} />

      <section className="surface-card recipe-panel" aria-labelledby="ingredients-title">
        <div className="recipe-panel__header">
          <h2 id="ingredients-title" className="font-playfair">Ingredientes</h2>
          <p className="text-muted">Marque o que já está separado para cozinhar sem distrações.</p>
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
                    {ingredient.notes ? <em> â€“ {ingredient.notes}</em> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="surface-card recipe-panel" aria-labelledby="steps-title">
        <div className="recipe-panel__header">
          <h2 id="steps-title" className="font-playfair">Modo de preparo</h2>
          <p className="text-muted">O passo a passo com dicas que você pode levar para o modo cozinha.</p>
        </div>
        <ol className="recipe-steps">
          {steps.map((step) => (
            <li key={step.order}>
              <div className="recipe-step__number">{step.order}</div>
              <div className="recipe-step__content">
                <p>{step.description}</p>
                {step.tips ? <span className="recipe-step__tip">ðŸ’¡ {step.tips}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface-card recipe-panel" aria-labelledby="notes-title">
        <div className="recipe-panel__header">
          <h2 id="notes-title" className="font-playfair">Observações pessoais</h2>
          <p className="text-muted">Registre ajustes e insights para a próxima execução.</p>
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={6}
          placeholder="Adicione ajustes, substituições ou lembretes para o seu eu futuro."
        />
        <div className="recipe-notes__actions">
          <button type="button" className="button button--primary" onClick={handleSaveNotes} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar observações'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setNotes(activeRecipe.notes ?? '')}
            disabled={isSaving}
          >
            Desfazer mudanças
          </button>
        </div>
      </section>
    </div>
  );
};

export default RecipeDetailPage;


