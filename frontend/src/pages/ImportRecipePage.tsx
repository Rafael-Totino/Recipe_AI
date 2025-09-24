import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useRecipes } from '../context/RecipeContext';

const ImportRecipePage = () => {
  const { importRecipe, createManualRecipe } = useRecipes();
  const [url, setUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualSteps, setManualSteps] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url) {
      return;
    }
    setIsSubmitting(true);
    const result = await importRecipe(url);
    setIsSubmitting(false);
    if (result?.recipe) {
      setStatusMessage('Receita importada com sucesso!');
      navigate(`/app/recipes/${result.recipe.id}`);
    } else {
      setStatusMessage('Não conseguimos importar a receita. Tente novamente com outro link.');
    }
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const ingredients = manualIngredients
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ name: line }));
    const steps = manualSteps
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((description, index) => ({ order: index + 1, description }));

    const recipe = await createManualRecipe({
      title: manualTitle,
      description: manualDescription,
      ingredients,
      steps,
      source: { importedFrom: 'manual' }
    });

    setIsSubmitting(false);

    if (recipe) {
      setStatusMessage('Receita criada! Vamos cozinhar?');
      navigate(`/app/recipes/${recipe.id}`);
    } else {
      setStatusMessage('Não foi possível salvar a receita.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section className="surface-card" style={{ display: 'grid', gap: '1rem' }}>
        <h2>Importar de redes sociais</h2>
        <p style={{ margin: 0, color: 'var(--color-muted)' }}>
          Cole um link do YouTube, Instagram, TikTok ou blog. A IA vai extrair instruções, ingredientes e áudio.
        </p>
        <form onSubmit={handleImport} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.instagram.com/p/..."
            style={{ flex: 1, minWidth: '240px' }}
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              borderRadius: '16px',
              border: 'none',
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #ff6f61, #ff922b)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isSubmitting ? 'Importando...' : 'Importar'}
          </button>
        </form>
      </section>

      <section className="surface-card" style={{ display: 'grid', gap: '1rem' }}>
        <h2>Adicionar receita manualmente</h2>
        <form onSubmit={handleManualSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Título</span>
            <input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              required
              placeholder="O melhor bolo de cenoura"
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Descrição</span>
            <textarea
              value={manualDescription}
              onChange={(event) => setManualDescription(event.target.value)}
              rows={3}
              placeholder="Uma sobremesa rápida com cobertura de chocolate"
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Ingredientes (um por linha)</span>
            <textarea
              value={manualIngredients}
              onChange={(event) => setManualIngredients(event.target.value)}
              rows={4}
              placeholder={['3 cenouras médias', '2 xícaras de farinha', '1 xícara de açúcar'].join('\n')}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Modo de preparo (passo por linha)</span>
            <textarea
              value={manualSteps}
              onChange={(event) => setManualSteps(event.target.value)}
              rows={4}
              placeholder={['Bata as cenouras com óleo e ovos', 'Misture os secos', 'Asse por 40 minutos'].join('\n')}
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              borderRadius: '16px',
              border: 'none',
              padding: '0.85rem 1.2rem',
              background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar receita'}
          </button>
        </form>
      </section>

      {statusMessage ? (
        <div className="surface-card surface-card--muted" style={{ color: 'var(--color-primary-strong)' }}>
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
};

export default ImportRecipePage;
