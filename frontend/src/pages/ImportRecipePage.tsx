import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Loader from '../components/shared/Loader';
import { useRecipes } from '../context/RecipeContext';
import './import.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

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
  const navigate = useNavigate();

  const isBusy = isImporting || isSavingManual;
  const overlayMessage = useMemo(
    () => (isImporting ? 'Importando receita...' : 'Salvando receita...'),
    [isImporting]
  );

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
          message: 'Nao conseguimos importar a receita. Tente novamente com outro link.',
        });
      }
    } catch (error) {
      console.error('Import recipe failed', error);
      setStatus({
        type: 'error',
        message: 'Falha inesperada ao importar. Verifique a conexao e tente novamente.',
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
        setStatus({ type: 'error', message: 'Nao foi possivel salvar a receita.' });
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
      <section className="surface-card import-card" tabIndex={0}>
        <div className="import-card__intro">
          <h2>Importar de redes sociais</h2>
          <p className="text-muted">
            Cole um link do YouTube, Instagram, TikTok ou blog. A IA extrai instrucoes, ingredientes e audio automaticamente.
          </p>
        </div>
        <form className="import-card__form" onSubmit={handleImport} aria-busy={isImporting}>
          <input
            className="import-card__input"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.instagram.com/p/..."
            minLength={8}
            required
            disabled={isBusy}
          />
          <button
            type="submit"
            className="import-button"
            disabled={isBusy}
            data-loading={isImporting}
          >
            {isImporting ? (
              <>
                <Loader />
                <span>Importando...</span>
              </>
            ) : (
              <span>Importar</span>
            )}
          </button>
        </form>
      </section>

      <section className="surface-card import-card" tabIndex={0}>
        <div className="import-card__intro">
          <h2>Adicionar receita manualmente</h2>
          <p className="text-muted">
            Preencha os campos abaixo para registrar uma receita personalizada no seu livro digital.
          </p>
        </div>
        <form className="import-card__layout" onSubmit={handleManualSubmit} aria-busy={isSavingManual}>
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
              placeholder={['3 cenouras medias', '2 xicaras de farinha', '1 xicara de acucar'].join('\n')}
              disabled={isBusy}
            />
          </label>

          <label className="import-field">
            <span>Modo de preparo (passo por linha)</span>
            <textarea
              value={manualSteps}
              onChange={(event) => setManualSteps(event.target.value)}
              rows={4}
              placeholder={['Bata as cenouras com oleo e ovos', 'Misture os secos', 'Asse por 40 minutos'].join('\n')}
              disabled={isBusy}
            />
          </label>

          <div className="import-card__actions">
            <button
              type="submit"
              className="import-button import-button--secondary"
              disabled={isBusy || !manualTitle.trim()}
              data-loading={isSavingManual}
            >
              {isSavingManual ? (
                <>
                  <Loader />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar receita</span>
              )}
            </button>
          </div>
        </form>
      </section>

      {status ? (
        <div
          className={`surface-card surface-card--muted import-status import-status--${status.type}`}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </div>
      ) : null}

      {isBusy ? (
        <div className="import-page__overlay" role="status" aria-live="polite">
          <div className="import-page__overlay-content">
            <Loader />
            <p>{overlayMessage}</p>
            <small>Isso pode levar alguns segundos enquanto buscamos todas as informacoes.</small>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImportRecipePage;
