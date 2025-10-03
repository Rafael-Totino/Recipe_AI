import { type MouseEvent, useEffect } from 'react';

import ChatDock from './ChatDock';
import './chat.css';

type ChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
};

export function ChatModal({ isOpen, onClose, initialPrompt }: ChatModalProps) {
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

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="chat-modal" role="dialog" aria-modal="true" aria-label="Assistente de receitas">
      <div className="chat-modal__backdrop" onClick={handleBackdropClick} />
      <div className="chat-modal__content">
        <button type="button" className="chat-modal__close" onClick={onClose} aria-label="Fechar assistente">
          <span aria-hidden="true">×</span>
        </button>
        <ChatDock initialPrompt={initialPrompt} />
      </div>
    </div>
  );
}

export default ChatModal;
