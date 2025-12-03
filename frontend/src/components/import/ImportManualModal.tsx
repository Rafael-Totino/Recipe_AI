import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

import Loader from '../shared/Loader';
import { useRecipes } from '../../context/RecipeContext';
import './import-modals.css';
import '../../pages/import.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

const loadingStages = ['Organizando ingredientes', 'Escrevendo instrucoes', 'Polindo sua receita'];

type ImportManualModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
};

export const ImportManualModal = ({ isOpen, onClose, onBack }: ImportManualModalProps) => {
  const { createManualRecipe } = useRecipes();
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualSteps, setManualSteps] = useState('');
  const [manualServings, setManualServings] = useState('');
  const [manualDuration, setManualDuration] = useState('');
  const [manualDifficulty, setManualDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [manualTags, setManualTags] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const navigate = useNavigate();

  const isBusy = isSavingManual;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isBusy) {
      setStageIndex(0);
      return undefined;
    }

    const id = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % loadingStages.length);
    }, 2000);

    return () => window.clearInterval(id);
  }, [isBusy]);

  useEffect(() => {
    if (!isOpen) {
      setManualTitle('');
      setManualDescription('');
      setManualIngredients('');
      setManualSteps('');
      setManualServings('');
      setManualDuration('');
      setManualDifficulty('');
      setManualTags('');
      setStatus(null);
      setIsSavingManual(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const placeholderIngredients = useMemo(
    () => ['3 cenouras medias', '2 xicaras de farinha', '1 xicara de acucar'].join('\n'),
    []
  );

  const placeholderSteps = useMemo(
    () => ['Bata as cenouras com oleo e ovos', 'Misture os secos', 'Asse por 40 minutos'].join('\n'),
    []
  );

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSavingManual(true);

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
        title: manualTitle,
        description: manualDescription,
        ingredients,
        steps,
        servings: manualServings ? Number(manualServings) : undefined,
        durationMinutes: manualDuration ? Number(manualDuration) : undefined,
        difficulty: manualDifficulty || undefined,
        tags: tags.length ? tags : undefined,
        source: { importedFrom: 'manual' }
      });

      if (recipe) {
        setStatus({ type: 'success', message: 'Receita criada! Vamos cozinhar?' });
        navigate(`/app/recipes/${recipe.id}`);
        onClose();
      } else {
        setStatus({ type: 'error', message: 'Nao foi possivel salvar a receita.' });
      }
    } catch (error) {
      console.error('Manual recipe creation failed', error);
      setStatus({
        type: 'error',
        message: 'Falha inesperada ao salvar receita manual.'
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="import-modal" role="dialog" aria-modal="true" aria-label="Cadastrar receita manualmente">
      <div className="import-modal__backdrop" onClick={onClose} />
      <div className="import-modal__content" role="document">
        <header className="import-modal__header import-modal__header--split">
          <button type="button" className="import-modal__back" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar
          </button>
          <div className="import-modal__title">
            <span className="eyebrow">Livro do Chef</span>
            <h2 className="font-playfair">Registrar receita manualmente</h2>
            <p>Descreva sua criacao autoral e deixe a cozinha inteligente guardar seus segredos.</p>
          </div>
          <button type="button" className="import-modal__close" onClick={onClose} aria-label="Fechar cadastro manual">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="import-modal__scroll">
          <form className="import-card__layout" onSubmit={handleManualSubmit} aria-busy={isBusy}>
            <div className="import-manual__meta">
              <label className="import-field">
                <span>Porcoes</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={manualServings}
                  onChange={(event) => setManualServings(event.target.value)}
                  placeholder="4"
                  disabled={isBusy}
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
                  disabled={isBusy}
                />
              </label>

              <label className="import-field">
                <span>Dificuldade</span>
                <select
                  value={manualDifficulty}
                  onChange={(event) =>
                    setManualDifficulty(event.target.value as 'easy' | 'medium' | 'hard' | '')
                  }
                  disabled={isBusy}
                >
                  <option value="">Selecione</option>
                  <option value="easy">Facil</option>
                  <option value="medium">Intermediaria</option>
                  <option value="hard">Dificil</option>
                </select>
              </label>
            </div>

            <label className="import-field">
              <span>Titulo</span>
              <input
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                required
                placeholder="O melhor bolo de cenoura"
                disabled={isBusy}
              />
            </label>

            <label className="import-field">
              <span>Descricao</span>
              <textarea
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
                rows={3}
                placeholder="Uma sobremesa rapida com cobertura de chocolate"
                disabled={isBusy}
              />
            </label>

            <label className="import-field">
              <span>Ingredientes (um por linha)</span>
              <textarea
                value={manualIngredients}
                onChange={(event) => setManualIngredients(event.target.value)}
                rows={4}
                placeholder={placeholderIngredients}
                disabled={isBusy}
              />
            </label>

            <label className="import-field">
              <span>Modo de preparo (passo por linha)</span>
              <textarea
                value={manualSteps}
                onChange={(event) => setManualSteps(event.target.value)}
                rows={4}
                placeholder={placeholderSteps}
                disabled={isBusy}
              />
            </label>

            <label className="import-field">
              <span>Tags (separe com virgula)</span>
              <input
                value={manualTags}
                onChange={(event) => setManualTags(event.target.value)}
                placeholder="bolo, sobremesa, chocolate"
                disabled={isBusy}
              />
            </label>

            <div className="import-card__actions">
              <button
                type="submit"
                className="button button--secondary"
                disabled={isBusy || !manualTitle.trim()}
                data-loading={isBusy}
              >
                {isBusy ? 'Salvando...' : 'Guardar receita'}
              </button>
            </div>

            {status ? (
              <p className={`import-status import-status--${status.type}`} role="status">
                {status.message}
              </p>
            ) : null}
          </form>
        </div>

        {isBusy ? (
          <div className="import-modal__overlay" role="alert" aria-live="assertive">
            <div className="import-modal__overlay-card">
              <Loader />
              <p>Salvando receita...</p>
              <small>{loadingStages[stageIndex]}</small>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImportManualModal;
