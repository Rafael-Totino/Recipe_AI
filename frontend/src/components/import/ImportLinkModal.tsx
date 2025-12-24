import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

import Loader from '../shared/Loader';
import { useRecipes } from '../../context/RecipeContext';
import './import-modals.css';
import '../../pages/home.css';
import '../../pages/import.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

const loadingStages = ['Lendo sabores', 'Decifrando histórias', 'Estruturando a obra-prima'];

type ImportLinkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
};

export const ImportLinkModal = ({ isOpen, onClose, onBack }: ImportLinkModalProps) => {
  const { importRecipe } = useRecipes();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<StatusState>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const navigate = useNavigate();
  const favicon = useMemo(() => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${parsed.hostname}`;
    } catch {
      return null;
    }
  }, [url]);

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
    if (!isImporting) {
      setStageIndex(0);
      return undefined;
    }

    const id = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % loadingStages.length);
    }, 2000);

    return () => window.clearInterval(id);
  }, [isImporting]);

  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setStatus(null);
      setIsImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

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
        onClose();
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

  return (
    <div className="import-modal" role="dialog" aria-modal="true" aria-label="Importar receita via link">
      <div className="import-modal__backdrop" onClick={onClose} />
      <div className="import-modal__content" role="document">
        <header className="import-modal__header import-modal__header--split">
          <button type="button" className="import-modal__back" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar
          </button>
          <div className="import-modal__title">
            <span className="eyebrow">O Laboratório</span>
            <h2 className="font-playfair">Importar pelo link</h2>
            <p>Cole a URL de um vídeo, post ou artigo culinário para que a IA organize tudo para você.</p>
          </div>
          <button
            type="button"
            className="import-modal__close"
            onClick={onClose}
            aria-label="Fechar importação por link"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="import-modal__scroll">
          <form className="timeline__import-form" onSubmit={handleImport} aria-busy={isImporting}>
            <div className={`timeline__import-field${favicon ? ' timeline__import-field--favicon' : ''}`}>
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
                disabled={isImporting}
              />
              <button type="submit" disabled={isImporting} data-loading={isImporting}>
                {isImporting ? 'Processando...' : 'Criar receita'}
              </button>
            </div>
            <small className="import-page__hint">YouTube, Instagram, TikTok, blogs e muito mais.</small>
            {status ? (
              <p className={`timeline__import-status timeline__import-status--${status.type}`} role="status">
                {status.message}
              </p>
            ) : null}
          </form>
        </div>

        {isImporting ? (
          <div className="import-modal__overlay" role="alert" aria-live="assertive">
            <div className="import-modal__overlay-card">
              <Loader />
              <p>Importando receita...</p>
              <small>{loadingStages[stageIndex]}</small>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImportLinkModal;
