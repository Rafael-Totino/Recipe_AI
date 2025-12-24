import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import Loader from '../components/shared/Loader';
import { useRecipes } from '../context/RecipeContext';
import './import.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

const loadingStages = ['Organizando ingredientes', 'Escrevendo instruções', 'Polindo sua receita'];

const ImportManualPage = () => {
  const { createManualRecipe } = useRecipes();
  const navigate = useNavigate();

  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualSteps, setManualSteps] = useState('');
  const [manualServings, setManualServings] = useState('');
  const [manualDuration, setManualDuration] = useState('');
  const [manualDifficulty, setManualDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [manualTags, setManualTags] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  const placeholderIngredients = useMemo(
    () => ['3 cenouras médias', '2 xícaras de farinha', '1 xícara de açúcar'].join('\n'),
    []
  );

  const placeholderSteps = useMemo(
    () => ['Bata as cenouras com óleo e ovos', 'Misture os secos', 'Asse por 40 minutos'].join('\n'),
    []
  );

  useEffect(() => {
    if (!isSaving) {
      setStageIndex(0);
      return undefined;
    }

    const id = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % loadingStages.length);
    }, 2000);

    return () => window.clearInterval(id);
  }, [isSaving]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setStatus(null);
    setIsSaving(true);

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

    const tags = manualTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const recipe = await createManualRecipe({
        title: manualTitle.trim(),
        description: manualDescription.trim() || undefined,
        ingredients,
        steps,
        servings: manualServings ? Number(manualServings) : undefined,
        durationMinutes: manualDuration ? Number(manualDuration) : undefined,
        difficulty: manualDifficulty || undefined,
        tags: tags.length ? tags : undefined,
        source: { importedFrom: 'manual' }
      });

      if (recipe) {
        setStatus({ type: 'success', message: 'Receita criada! Abrindo detalhes...' });
        navigate(`/app/recipes/${recipe.id}`);
      } else {
        setStatus({ type: 'error', message: 'Não foi possível salvar a receita.' });
      }
    } catch {
      setStatus({
        type: 'error',
        message: 'Falha inesperada ao salvar receita manual.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`import-page${isSaving ? ' import-page--busy' : ''}`}>
      <div className="import-card__actions">
        <button type="button" className="button button--ghost" onClick={() => navigate(-1)} disabled={isSaving}>
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar
        </button>
      </div>

      <section className="import-manual">
        <header className="timeline__import-header">
          <span className="eyebrow">Livro do Chef</span>
          <h1>Registrar receita manualmente</h1>
          <p>Preencha os campos abaixo para guardar sua criação no seu livro de receitas.</p>
        </header>

        <form className="import-card__layout" onSubmit={handleSubmit} aria-busy={isSaving}>
          <div className="import-manual__meta">
            <label className="import-field">
              <span>Porções</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={manualServings}
                onChange={(event) => setManualServings(event.target.value)}
                placeholder="4"
                disabled={isSaving}
              />
            </label>

            <label className="import-field">
              <span>Tempo (min)</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={manualDuration}
                onChange={(event) => setManualDuration(event.target.value)}
                placeholder="40"
                disabled={isSaving}
              />
            </label>

            <label className="import-field">
              <span>Dificuldade</span>
              <select
                value={manualDifficulty}
                onChange={(event) =>
                  setManualDifficulty(event.target.value as 'easy' | 'medium' | 'hard' | '')
                }
                disabled={isSaving}
              >
                <option value="">Selecione</option>
                <option value="easy">Fácil</option>
                <option value="medium">Média</option>
                <option value="hard">Difícil</option>
              </select>
            </label>
          </div>

          <label className="import-field">
            <span>Título</span>
            <input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="Bolo de cenoura"
              required
              disabled={isSaving}
            />
          </label>

          <label className="import-field">
            <span>Descrição</span>
            <textarea
              value={manualDescription}
              onChange={(event) => setManualDescription(event.target.value)}
              placeholder="Uma receita clássica e fofinha, perfeita para o café."
              rows={3}
              disabled={isSaving}
            />
          </label>

          <label className="import-field">
            <span>Ingredientes (1 por linha)</span>
            <textarea
              value={manualIngredients}
              onChange={(event) => setManualIngredients(event.target.value)}
              placeholder={placeholderIngredients}
              rows={6}
              disabled={isSaving}
            />
          </label>

          <label className="import-field">
            <span>Modo de preparo (1 passo por linha)</span>
            <textarea
              value={manualSteps}
              onChange={(event) => setManualSteps(event.target.value)}
              placeholder={placeholderSteps}
              rows={6}
              disabled={isSaving}
            />
          </label>

          <label className="import-field">
            <span>Tags (separadas por vírgula)</span>
            <input
              value={manualTags}
              onChange={(event) => setManualTags(event.target.value)}
              placeholder="bolo, sobremesa, chocolate"
              disabled={isSaving}
            />
          </label>

          <div className="import-card__actions">
            <button
              type="submit"
              className="button button--secondary"
              disabled={isSaving || !manualTitle.trim()}
              data-loading={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Guardar receita'}
            </button>
          </div>

          {status ? (
            <p className={`import-status import-status--${status.type}`} role="status">
              {status.message}
            </p>
          ) : null}
        </form>
      </section>

      {isSaving ? (
        <div className="import-page__overlay" role="alert" aria-live="assertive">
          <div className="import-page__overlay-content">
            <Loader />
            <p>Salvando receita...</p>
            <small>{loadingStages[stageIndex]}</small>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImportManualPage;

