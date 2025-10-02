import { FormEvent } from 'react';

import './chat.css';

interface ChatInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSend: (message: string) => Promise<void>;
  isSending?: boolean;
}

const ChatInput = ({ value, onChange, onSend, isSending }: ChatInputProps) => {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    await onSend(value.trim());
  };

  // Adiciona evento para expandir chat-area e minimizar sidebar
  const handleFocus = () => {
    document.body.classList.add('chat-focus');
  };
  const handleBlur = () => {
    document.body.classList.remove('chat-focus');
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <textarea
        placeholder="Converse com o seu sous-chef de IA..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <button type="submit" disabled={!value.trim() || isSending}>
        {isSending ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
};

export default ChatInput;
