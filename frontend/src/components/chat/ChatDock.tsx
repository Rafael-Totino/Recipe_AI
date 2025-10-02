import { useCallback, useMemo } from 'react';

import { useChat } from '../../context/ChatContext';
import Loader from '../shared/Loader';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import './chat.css';

const ChatDock = () => {
  const {
    messages,
    sessions,
    isLoading,
    isSending,
    error,
    sendMessage,
    startNewChat,
    activeChatId,
    selectChat
  } = useChat();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }),
    []
  );

  const formatTabMeta = useCallback(
    (updatedAt: string, messageCount: number) => {
      try {
        const formatted = dateFormatter.format(new Date(updatedAt));
        if (messageCount <= 0) {
          return formatted;
        }
        return `${formatted} · ${messageCount} mensagens`;
      } catch (err) {
        console.error(err);
        return messageCount > 0 ? `${messageCount} mensagens` : '';
      }
    },
    [dateFormatter]
  );

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
        <button
          type="button"
          className="button button--secondary"
          onClick={startNewChat}
        >
          Nova conversa
        </button>
      </header>

      {sessions.length > 1 ? (
        <div className="chat-dock__tabs" role="tablist" aria-label="Conversas salvas">
          {sessions.map((session) => {
            const isActive = session.id === activeChatId;
            return (
              <button
                key={session.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`chat-dock__tab${isActive ? ' is-active' : ''}`}
                onClick={() => selectChat(session.id)}
              >
                <span className="chat-dock__tab-title" title={session.title}>
                  {session.title}
                </span>
                <span className="chat-dock__tab-meta">
                  {formatTabMeta(session.updatedAt, session.messageCount)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

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
