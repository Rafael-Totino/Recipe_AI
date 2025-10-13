import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ShieldAlert, X } from 'lucide-react';

import './import-modals.css';

type ImportCameraModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
};

export const ImportCameraModal = ({ isOpen, onClose, onBack }: ImportCameraModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isOpen) {
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu dispositivo não suporta captura de vídeo.');
        return;
      }

      setIsStarting(true);
      setError(null);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play();
        }
      } catch (err) {
        console.error('Camera permission denied', err);
        setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      } finally {
        setIsStarting(false);
      }
    };

    void startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="import-modal" role="dialog" aria-modal="true" aria-label="Importar receita com a câmera">
      <div className="import-modal__backdrop" onClick={onClose} />
      <div className="import-modal__content" role="document">
        <header className="import-modal__header import-modal__header--split">
          <button type="button" className="import-modal__back" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar
          </button>
          <div className="import-modal__title">
            <span className="eyebrow">Digitalização</span>
            <h2 className="font-playfair">Digitalizar com a câmera</h2>
            <p>Aponte a câmera para receitas manuscritas ou impressas para capturarmos os ingredientes.</p>
          </div>
          <button
            type="button"
            className="import-modal__close"
            onClick={onClose}
            aria-label="Fechar digitalização por câmera"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="import-modal__scroll">
          <div className="import-modal__camera" role="group" aria-label="Visualização da câmera">
            <div className="import-modal__camera-frame">
              <video ref={videoRef} className="import-modal__camera-video" playsInline muted />
              {!isStarting && !error ? (
                <div className="import-modal__camera-overlay" aria-hidden="true">
                  <div className="import-modal__camera-target" />
                </div>
              ) : null}
              {isStarting ? (
                <div className="import-modal__camera-status">Ativando câmera...</div>
              ) : null}
              {error ? (
                <div className="import-modal__camera-error" role="alert">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>

            <div className="import-modal__camera-instructions">
              <p>
                Posicione o caderno ou folha em uma superfície plana, em um ambiente bem iluminado. Vamos
                detectar automaticamente o texto e sugerir uma transcrição para você revisar.
              </p>
              <ul>
                <li>Mantenha o enquadramento dentro da borda destacada.</li>
                <li>Evite reflexos apontando a câmera levemente para baixo.</li>
                <li>Ao finalizar, você poderá revisar e editar cada ingrediente.</li>
              </ul>
            </div>

            <div className="import-modal__camera-actions">
              <button type="button" className="button button--primary" disabled>
                <Camera size={18} aria-hidden="true" />
                Digitalizar (em breve)
              </button>
              <p className="import-modal__camera-disclaimer">
                Em breve você poderá capturar e transformar instantaneamente suas receitas manuscritas. Enquanto isso,
                utilize o link ou preenchimento manual para importar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportCameraModal;
