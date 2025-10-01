import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ChatDock from '../chat/ChatDock';
import './chat-modal.css';

type ChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="chat-modal-overlay"
      onClick={(e) => e.target === modalRef.current && onClose()}
      ref={modalRef}
    >
      <div className="chat-modal">
        <div className="chat-modal__header">
          <h2>Chef IA</h2>
          <button onClick={onClose} className="chat-modal__close">
            <X size={24} />
          </button>
        </div>
        <div className="chat-modal__content">
          <ChatDock />
        </div>
      </div>
    </div>
  );
}
