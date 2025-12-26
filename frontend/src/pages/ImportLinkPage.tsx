import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader as LoaderIcon, Wand2 } from 'lucide-react';

import Loader from '../components/shared/Loader';
import { useRecipes } from '../context/RecipeContext';
import './home.css';
import './import.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

const loadingStages = ['Lendo sabores...', 'Identificando ingredientes...', 'Escrevendo a receita...'];

const ImportLinkPage = () => {
  const { importRecipe } = useRecipes();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isImporting) {
      setStageIndex(0);
      return undefined;
    }

    const id = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % loadingStages.length);
    }, 2000);

    return () => window.clearInterval(id);
  }, [isImporting]);

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
    if (!trimmedUrl || isImporting) return;

    setStatus(null);
    setIsImporting(true);

    try {
      const result = await importRecipe(trimmedUrl);

      if (result?.recipe) {
        setStatus({ type: 'success', message: 'Concluído! Redirecionando...' });
        navigate(`/app/recipes/${result.recipe.id}`);
      } else {
        setStatus({
          type: 'error',
          message: 'Não foi possível importar. Verifique o link.'
        });
      }
    } catch {
      setStatus({
        type: 'error',
        message: 'Erro desconhecido. Tente novamente.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className={`import-page${isImporting ? ' import-page--busy' : ''}`}>
      <div className="import-card__actions">
        <button type="button" className="button button--ghost" onClick={() => navigate(-1)} disabled={isImporting}>
          <ArrowLeft size={20} />
          Voltar
        </button>
      </div>

      <section className="timeline__import">
        <header className="timeline__import-header">
          <div className="timeline__import-header-title">
            <Wand2 className="timeline__import-icon" size={24} />
            <h1>Importar via Link</h1>
          </div>
          <p>Cole o link e deixe a IA fazer o resto.</p>
        </header>

        <form className="timeline__import-form import-page__import-form" onSubmit={handleImport} aria-busy={isImporting}>
          <div className={`timeline__import-field${favicon ? ' timeline__import-field--favicon' : ''}`}>
            {favicon ? <img src={favicon} alt="" className="timeline__import-favicon" /> : null}
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Cole o link aqui..."
              aria-label="Link da receita"
              minLength={8}
              required
              disabled={isImporting}
            />
            <button type="submit" disabled={isImporting} data-loading={isImporting}>
              {isImporting ? <LoaderIcon className="animate-spin" size={20} /> : 'Criar'}
            </button>
          </div>

          <p className="import-page__hint">Suporta YouTube, Instagram, TikTok e blogs.</p>

          {status ? (
            <p className={`timeline__import-status timeline__import-status--${status.type}`} role="status">
              {status.message}
            </p>
          ) : null}
        </form>
      </section>

      {isImporting ? (
        <div className="import-page__overlay" role="alert" aria-live="assertive">
          <div className="import-page__overlay-content">
            <Loader />
            <p>Trabalhando...</p>
            <small>{loadingStages[stageIndex]}</small>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImportLinkPage;


