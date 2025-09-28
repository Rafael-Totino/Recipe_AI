import { FormEvent, useState } from 'react';

import './chat.css';

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  isSending?: boolean;
}

const ChatInput = ({ onSend, isSending }: ChatInputProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    await onSend(value.trim());
    setValue('');
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
        onChange={(event) => setValue(event.target.value)}
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
