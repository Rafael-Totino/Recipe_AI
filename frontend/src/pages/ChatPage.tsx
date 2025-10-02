import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import ChatDock from '../components/chat/ChatDock';
import { useChat } from '../context/ChatContext';
import './chat-page.css';

type LocationState = {
  prompt?: string;
} | null;

const ChatPage = () => {
  const { hydrate } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);

  const pendingPrompt = useMemo(() => {
    const state = location.state as LocationState;
    return typeof state?.prompt === 'string' ? state.prompt : undefined;
  }, [location.state]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (pendingPrompt && pendingPrompt.trim()) {
      setInitialPrompt(pendingPrompt);
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, navigate, pendingPrompt]);

  return (
    <div className="chat-page">
      <header className="chat-page__header">
        <span className="chat-page__eyebrow">Chef IA</span>
        <h1 className="chat-page__title">Planeje, ajuste e aprenda em tempo real</h1>
        <p className="chat-page__subtitle">
          O chat acompanha cada receita e traz técnicas, substituições e ideias comerciais para o seu livro digital.
        </p>
      </header>
      <div className="chat-page__body">
        <ChatDock initialPrompt={initialPrompt} />
      </div>
    </div>
  );
};

export default ChatPage;
