import { useEffect } from 'react';
import { Camera, Link2, PencilLine, X } from 'lucide-react';

import './import-modals.css';

export type ImportOptionType = 'link' | 'camera' | 'manual';

type ImportOptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: ImportOptionType) => void;
};

export const ImportOptionsModal = ({ isOpen, onClose, onSelect }: ImportOptionsModalProps) => {
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

  const handleBackdropClick = () => {
    onClose();
  };

  const handleSelect = (option: ImportOptionType) => {
    onSelect(option);
  };

  return (
    <div className="import-modal import-modal--sheet" role="dialog" aria-modal="true" aria-label="Importar receita">
      <div className="import-modal__backdrop" onClick={handleBackdropClick} />
      <div className="import-modal__sheet" role="document">
        <header className="import-modal__header">
          <div>
            <span className="eyebrow">Importar receita</span>
            <h2>Como deseja começar?</h2>
            <p className="text-muted">Selecione uma das opções abaixo para trazer sua receita ao atelier.</p>
          </div>
          <button type="button" className="import-modal__close" onClick={onClose} aria-label="Fechar opções de importação">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="import-modal__options" role="list">
          <button
            type="button"
            className="import-modal__option"
            onClick={() => handleSelect('link')}
            role="listitem"
          >
            <span className="import-modal__option-icon" aria-hidden="true">
              <Link2 size={24} />
            </span>
            <span className="import-modal__option-title">Link</span>
            <span className="import-modal__option-description">Cole a URL de um vídeo ou artigo culinário.</span>
          </button>

          <button
            type="button"
            className="import-modal__option"
            onClick={() => handleSelect('camera')}
            role="listitem"
          >
            <span className="import-modal__option-icon" aria-hidden="true">
              <Camera size={24} />
            </span>
            <span className="import-modal__option-title">Câmera</span>
            <span className="import-modal__option-description">Digitalize uma receita escrita com a câmera do celular.</span>
          </button>

          <button
            type="button"
            className="import-modal__option"
            onClick={() => handleSelect('manual')}
            role="listitem"
          >
            <span className="import-modal__option-icon" aria-hidden="true">
              <PencilLine size={24} />
            </span>
            <span className="import-modal__option-title">Manualmente</span>
            <span className="import-modal__option-description">Escreva os ingredientes e passos do seu próprio jeito.</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportOptionsModal;
