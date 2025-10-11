import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import { useRecipes } from '../context/RecipeContext';
import './home.css';
import './import.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

const loadingStages = ['Lendo sabores', 'Decifrando histórias', 'Estruturando a obra-prima'];

const ImportRecipePage = () => {
  const { importRecipe, createManualRecipe } = useRecipes();
  const [url, setUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualSteps, setManualSteps] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const navigate = useNavigate();

  const isBusy = isImporting || isSavingManual;
  const overlayMessage = useMemo(
    () => (isImporting ? 'Importando receita...' : 'Salvando receita...'),
    [isImporting]
  );

  useEffect(() => {
    if (!isBusy) {
      setStageIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % loadingStages.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [isBusy]);

  const favicon = useMemo(() => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${parsed.hostname}`;
    } catch {
      return null;
    }
  }, [url]);

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return;
    }
    setStatus(null);
    setIsImporting(true);
    try {
      const result = await importRecipe(trimmedUrl);
      if (result?.recipe) {
        setStatus({ type: 'success', message: 'Receita importada com sucesso! Abrindo detalhes...' });
        navigate(`/app/recipes/${result.recipe.id}`);
      } else {
        setStatus({
          type: 'error',
          message: 'Não conseguimos importar a receita. Tente novamente com outro link.',
        });
      }
    } catch (error) {
      console.error('Import recipe failed', error);
      setStatus({
        type: 'error',
        message: 'Falha inesperada ao importar. Verifique a conexão e tente novamente.',
      });
    } finally {
      setIsImporting(false);
    }
  };

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

    try {
      const recipe = await createManualRecipe({
        title: manualTitle,
        description: manualDescription,
        ingredients,
        steps,
        source: { importedFrom: 'manual' },
      });

      if (recipe) {
        setStatus({ type: 'success', message: 'Receita criada! Vamos cozinhar?' });
        navigate(`/app/recipes/${recipe.id}`);
      } else {
        setStatus({ type: 'error', message: 'Não foi possível salvar a receita.' });
      }
    } catch (error) {
      console.error('Manual recipe creation failed', error);
      setStatus({
        type: 'error',
        message: 'Falha inesperada ao salvar receita manual.',
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className={`import-page${isBusy ? ' import-page--busy' : ''}`}>
      <section className="timeline__import" aria-labelledby="import-page-title">
        <div className="timeline__import-header">
          <span className="eyebrow">O Laboratório</span>
          <h1 id="import-page-title" className="font-playfair">
            Importe uma receita e deixe a IA lapidar os detalhes
          </h1>
          <p>
            Cole o link de um vídeo ou artigo culinário. A assistente analisa, organiza e entrega os
            ingredientes, passos e áudios prontos para o modo cozinha.
          </p>
        </div>

        <form className="timeline__import-form import-page__import-form" onSubmit={handleImport} aria-busy={isImporting}>
          <div
            className={`timeline__import-field${favicon ? ' timeline__import-field--favicon' : ''}`}
          >
            {favicon ? (
              <img src={favicon} alt="Favicon do site" className="timeline__import-favicon" />
            ) : null}
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://exemplo.com/minha-receita"
              aria-label="Link da receita para importar"
              minLength={8}
              required
              disabled={isBusy}
            />
            <button type="submit" disabled={isBusy} data-loading={isImporting}>
              {isImporting ? 'Processando...' : 'Criar receita'}
            </button>
          </div>
          <small className="import-page__hint">YouTube, Instagram, TikTok, blogs e muito mais.</small>
          {status ? (
            <p className={`timeline__import-status timeline__import-status--${status.type}`}>
              {status.message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="surface-card import-manual" tabIndex={0}>
        <div className="import-card__intro">
          <h2 className="font-playfair">Registrar receita manualmente</h2>
          <p className="text-muted">
            Descreva sua criação autoral para que o atelier memorize sabores e técnicas exclusivas.
          </p>
        </div>
        <form className="import-card__layout" onSubmit={handleManualSubmit} aria-busy={isSavingManual}>
          <label className="import-field">
            <span>Título</span>
            <input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              required
              placeholder="O melhor bolo de cenoura"
              disabled={isBusy}
            />
          </label>

          <label className="import-field">
            <span>Descrição</span>
            <textarea
              value={manualDescription}
              onChange={(event) => setManualDescription(event.target.value)}
              rows={3}
              placeholder="Uma sobremesa rápida com cobertura de chocolate"
              disabled={isBusy}
            />
          </label>

          <label className="import-field">
            <span>Ingredientes (um por linha)</span>
            <textarea
              value={manualIngredients}
              onChange={(event) => setManualIngredients(event.target.value)}
              rows={4}
              placeholder={['3 cenouras médias', '2 xícaras de farinha', '1 xícara de açúcar'].join('\n')}
              disabled={isBusy}
            />
          </label>

          <label className="import-field">
            <span>Modo de preparo (passo por linha)</span>
            <textarea
              value={manualSteps}
              onChange={(event) => setManualSteps(event.target.value)}
              rows={4}
              placeholder={['Bata as cenouras com óleo e ovos', 'Misture os secos', 'Asse por 40 minutos'].join('\n')}
              disabled={isBusy}
            />
          </label>

          <div className="import-card__actions">
            <button
              type="submit"
              className="button button--secondary"
              disabled={isBusy || !manualTitle.trim()}
              data-loading={isSavingManual}
            >
              {isSavingManual ? 'Salvando...' : 'Guardar receita'}
            </button>
          </div>
        </form>
        {status && !isImporting ? (
          <p className={`import-status import-status--${status.type}`}>{status.message}</p>
        ) : null}
      </section>

      {isBusy ? (
        <div className="import-page__overlay" role="alert" aria-live="assertive">
          <div className="import-page__overlay-content">
            <Loader />
            <p>{overlayMessage}</p>
            <small>{loadingStages[stageIndex]}</small>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImportRecipePage;
