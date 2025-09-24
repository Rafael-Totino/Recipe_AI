import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import RecipePlayer from '../components/recipes/RecipePlayer';
import Loader from '../components/shared/Loader';
import { useRecipes } from '../context/RecipeContext';

const RecipeDetailPage = () => {
  const { recipeId } = useParams();
  const { activeRecipe, selectRecipe, updateNotes, toggleFavorite, removeRecipe } = useRecipes();
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (recipeId) {
      void selectRecipe(recipeId);
    }
  }, [recipeId, selectRecipe]);

  useEffect(() => {
    setNotes(activeRecipe?.notes ?? '');
  }, [activeRecipe?.notes]);

  const ingredients = activeRecipe?.ingredients ?? [];
  const steps = useMemo(() => (activeRecipe?.steps ?? []).sort((a, b) => a.order - b.order), [activeRecipe?.steps]);

  if (!activeRecipe) {
    return (
      <div className="surface-card" style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
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
    const confirm = window.confirm('Tem certeza que deseja remover esta receita?');
    if (!confirm) {
      return;
    }
    await removeRecipe(recipeId);
    navigate('/app');
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <header className="surface-card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>{activeRecipe.title}</h1>
            <p style={{ margin: 0, color: 'var(--color-muted)' }}>{activeRecipe.description}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => toggleFavorite(activeRecipe.id)}
              style={{
                borderRadius: '16px',
                border: 'none',
                padding: '0.65rem 1rem',
                background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {activeRecipe.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={{
                borderRadius: '16px',
                border: '1px solid rgba(124, 77, 255, 0.25)',
                padding: '0.65rem 1rem',
                background: '#fff',
                color: 'var(--color-primary-strong)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Compartilhar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              style={{
                borderRadius: '16px',
                border: '1px solid rgba(255, 111, 97, 0.35)',
                padding: '0.65rem 1rem',
                background: '#fff5f5',
                color: '#d64545',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Excluir
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--color-muted)' }}>
          {activeRecipe.durationMinutes ? <span>⏱️ {activeRecipe.durationMinutes} min</span> : null}
          {activeRecipe.servings ? <span>🍽️ {activeRecipe.servings} porções</span> : null}
          {activeRecipe.difficulty ? <span>🔥 {activeRecipe.difficulty}</span> : null}
          {activeRecipe.tags?.length ? <span>🏷️ {activeRecipe.tags.join(', ')}</span> : null}
        </div>
      </header>

      <RecipePlayer media={activeRecipe.media} source={activeRecipe.source} />

      <section className="surface-card" style={{ display: 'grid', gap: '1.25rem' }}>
        <div>
          <h2>Ingredientes</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.4rem' }}>
            {ingredients.map((ingredient) => (
              <li key={ingredient.name + ingredient.quantity}>
                <strong>{ingredient.quantity ? `${ingredient.quantity} ` : ''}</strong>
                {ingredient.name}
                {ingredient.notes ? <em style={{ color: 'var(--color-muted)' }}> – {ingredient.notes}</em> : null}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Modo de preparo</h2>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
            {steps.map((step) => (
              <li key={step.order}>
                <strong>Passo {step.order}:</strong> {step.description}
                {step.tips ? <span style={{ color: 'var(--color-muted)' }}> ({step.tips})</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="surface-card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2>Observações pessoais</h2>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={6}
          placeholder="Adicione ajustes, substituições ou lembretes para o seu eu futuro."
        />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={isSaving}
            style={{
              borderRadius: '16px',
              border: 'none',
              padding: '0.75rem 1.2rem',
              background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isSaving ? 'Salvando...' : 'Salvar observações'}
          </button>
          <button
            type="button"
            onClick={() => setNotes(activeRecipe.notes ?? '')}
            style={{
              borderRadius: '16px',
              border: '1px solid rgba(124, 77, 255, 0.25)',
              padding: '0.75rem 1.2rem',
              background: '#fff',
              color: 'var(--color-primary-strong)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Desfazer mudanças
          </button>
        </div>
      </section>
    </div>
  );
};

export default RecipeDetailPage;
