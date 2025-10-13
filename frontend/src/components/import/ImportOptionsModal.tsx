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
        <header className="import-modal__sheet-header">
          <h2>Importar receita</h2>
          <button type="button" className="import-modal__close" onClick={onClose} aria-label="Fechar opções de importação">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <p className="import-modal__sheet-subtitle">Como deseja começar?</p>

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
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportOptionsModal;
