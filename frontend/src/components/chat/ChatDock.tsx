import { useCallback } from 'react';

import { useChat } from '../../context/ChatContext';
import Loader from '../shared/Loader';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import './chat.css';

const ChatDock = () => {
  const { messages, isLoading, isSending, error, sendMessage, hydrate } = useChat();

  const handleSuggestion = useCallback(
    async (prompt: string) => {
      await sendMessage(prompt);
    },
    [sendMessage]
  );

  return (
    <section className="chat-dock" id="chat" aria-label="Assistente de receitas">
      <header className="chat-dock__header">
        <div>
          <span className="eyebrow">Chef IA</span>
          <h2>Planeje, ajuste e aprenda em tempo real</h2>
          <p className="text-muted">
            O chat acompanha cada receita e traz tecnicas, substituicoes e ideias comerciais para o seu livro digital.
          </p>
        </div>

      </header>

      <div className="chat-dock__history">
        {isLoading ? (
          <Loader />
        ) : messages.length ? (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} onSuggestionClick={handleSuggestion} />
          ))
        ) : (
          <p className="text-muted" style={{ textAlign: 'center' }}>
            Nenhuma conversa hoje. Pergunte o que preparar com o que voce tem em casa e veja a IA montar um plano completo.
          </p>
        )}
        {error ? <p style={{ color: '#d64545' }}>{error}</p> : null}
      </div>

      <div className="chat-dock__input">
        <ChatInput onSend={sendMessage} isSending={isSending} />
      </div>
    </section>
  );
};

export default ChatDock;
