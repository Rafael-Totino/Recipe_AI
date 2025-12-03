import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Image as ImageIcon, RefreshCcw, ShieldAlert, X } from 'lucide-react';

import { useRecipes } from '../../context/RecipeContext';
import './import-modals.css';

type StatusState = { type: 'success' | 'error'; message: string } | null;

type ImportCameraModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
};

export const ImportCameraModal = ({ isOpen, onClose, onBack }: ImportCameraModalProps) => {
  const { importRecipeFromImage } = useRecipes();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const loadingStages = ['Analisando foto', 'Detectando ingredientes', 'Gerando modo de preparo'];

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isOpen) {
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu dispositivo nao suporta captura de video.');
        return;
      }

      setIsStarting(true);
      setError(null);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play();
        }
      } catch (err) {
        console.error('Camera permission denied', err);
        setError('Nao foi possivel acessar a camera. Verifique as permissoes do navegador.');
      } finally {
        setIsStarting(false);
      }
    };

    void startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [isOpen]);

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
  }, [isImporting, loadingStages.length]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setStatus(null);
      setError(null);
      setIsImporting(false);
      setStageIndex(0);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    }
  }, [isOpen]);

  const captureSnapshot = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(new File([blob], 'captura-receita.jpg', { type: blob.type || 'image/jpeg' }));
        },
        'image/jpeg',
        0.9
      );
    });
  }, []);

  const handleCapture = useCallback(async () => {
    const file = await captureSnapshot();
    if (!file) {
      setError('Nao foi possivel capturar a imagem. Tente novamente.');
      return;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setSelectedFile(file);
    setStatus(null);
  }, [captureSnapshot]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setSelectedFile(file);
    setStatus(null);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStatus(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Escolha ou capture uma foto primeiro.' });
      return;
    }
    setIsImporting(true);
    setStatus(null);
    try {
      const result = await importRecipeFromImage(selectedFile);
      if (result?.recipe) {
        setStatus({ type: 'success', message: 'Receita importada. Abrindo detalhes...' });
        navigate(`/app/recipes/${result.recipe.id}`);
        onClose();
      } else {
        setStatus({
          type: 'error',
          message: 'Nao conseguimos ler os detalhes dessa imagem. Tente outra foto ou ajuste o enquadramento.'
        });
      }
    } catch (err) {
      console.error('Image import failed', err);
      setStatus({
        type: 'error',
        message: 'Falha ao processar a imagem. Verifique a conexao e tente novamente.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="import-modal" role="dialog" aria-modal="true" aria-label="Importar receita com a camera">
      <div className="import-modal__backdrop" onClick={onClose} />
      <div className="import-modal__content" role="document">
        <header className="import-modal__header import-modal__header--split">
          <button type="button" className="import-modal__back" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar
          </button>
          <div className="import-modal__title">
            <span className="eyebrow">Digitalizacao</span>
            <h2 className="font-playfair">Digitalizar com a camera</h2>
            <p>Capture ou envie uma foto da receita para extrair ingredientes e passos automaticamente.</p>
          </div>
          <button
            type="button"
            className="import-modal__close"
            onClick={onClose}
            aria-label="Fechar digitalizacao por camera"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="import-modal__scroll">
          <form className="import-modal__camera" onSubmit={handleSubmit} aria-busy={isImporting}>
            <div className="import-modal__camera-frame">
              <video ref={videoRef} className="import-modal__camera-video" playsInline muted />
              {!isStarting && !error ? (
                <div className="import-modal__camera-overlay" aria-hidden="true">
                  <div className="import-modal__camera-target" />
                </div>
              ) : null}
              {isStarting ? (
                <div className="import-modal__camera-status">Ativando camera...</div>
              ) : null}
              {error ? (
                <div className="import-modal__camera-error" role="alert">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>

            <div className="import-modal__camera-instructions">
              <p>Capture ou envie a foto da receita pronta para extrairmos os ingredientes e o modo de preparo.</p>
              <ul>
                <li>Prefira luz natural e enquadramento frontal.</li>
                <li>Evite cortes e reflexos para garantir leitura nitida.</li>
                <li>Voce podera revisar e editar a transcricao antes de salvar.</li>
              </ul>
            </div>

            <div className="import-modal__capture-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={handleCapture}
                disabled={isStarting || Boolean(error)}
              >
                <Camera size={18} aria-hidden="true" />
                Tirar foto agora
              </button>
              <label className="import-modal__upload">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  aria-label="Enviar foto da receita"
                  disabled={isImporting}
                />
                <ImageIcon size={18} aria-hidden="true" />
                Escolher da galeria
              </label>
              <button type="button" className="import-modal__reset" onClick={handleReset} disabled={!selectedFile}>
                <RefreshCcw size={16} aria-hidden="true" />
                Refazer captura
              </button>
            </div>

            {selectedFile ? (
              <div className="import-modal__preview" aria-label="Pre-visualizacao da imagem selecionada">
                <img src={previewUrlRef.current ?? ''} alt="Receita selecionada para importacao" />
                <div className="import-modal__preview-meta">
                  <span>{selectedFile.name}</span>
                  <span>{Math.round(selectedFile.size / 1024)} KB</span>
                </div>
              </div>
            ) : null}

            <div className="import-modal__camera-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={isImporting || !selectedFile}
                data-loading={isImporting}
              >
                {isImporting ? 'Processando...' : 'Importar receita'}
              </button>
              {status ? (
                <p className={`import-status import-status--${status.type}`} role="status">
                  {status.message}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        {isImporting ? (
          <div className="import-modal__overlay" role="alert" aria-live="assertive">
            <div className="import-modal__overlay-card">
              <Camera size={18} aria-hidden="true" />
              <p>Importando da foto...</p>
              <small>{loadingStages[stageIndex]}</small>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImportCameraModal;
