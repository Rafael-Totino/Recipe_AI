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

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <textarea
        placeholder="Converse com o seu sous-chef de IA..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
      />
      <button type="submit" disabled={!value.trim() || isSending}>
        {isSending ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
};

export default ChatInput;
