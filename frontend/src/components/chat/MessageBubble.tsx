import type { ChatMessage } from '../../types';
import { formatTime } from '../../utils/formatDate';
import './chat.css';

interface MessageBubbleProps {
  message: ChatMessage;
  onSuggestionClick?: (prompt: string) => void;
}

const MessageBubble = ({ message, onSuggestionClick }: MessageBubbleProps) => {
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble message-bubble--${isUser ? 'user' : 'assistant'}`}>
      <div>{message.content}</div>
      <div className="message-metadata">{formatTime(message.createdAt)}</div>
      {message.suggestions?.length ? (
        <div className="suggestion-list">
          {message.suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion.prompt}
              className="suggestion-pill"
              onClick={() => onSuggestionClick?.(suggestion.prompt)}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default MessageBubble;
