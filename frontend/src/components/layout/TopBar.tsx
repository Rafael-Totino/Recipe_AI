import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChefHat, Moon, Search, Sun } from 'lucide-react';

import { SearchDropdown } from './SearchDropdown';
import { useRecipes } from '../../context/RecipeContext';
import type { Recipe } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { ChatModal } from '../chat/ChatModal';

import './layout.css';

type TopBarProps = {
  forceCondensed?: boolean;
};

const getInitials = (value?: string | null) => {
  if (!value) {
    return '?';
  }
  const cleaned = value.trim();
  if (!cleaned) {
    return '?';
  }
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  const combined = `${first}${last}`.trim() || first;
  return combined.toUpperCase() || '?';
};

const TopBar = ({ forceCondensed }: TopBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { recipes, isLoading } = useRecipes();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { sendMessage } = useChat();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') ?? '';
  });
  const searchAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextQuery = params.get('q') ?? '';
    setQuery((current) => (current === nextQuery ? current : nextQuery));
  }, [location.search]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(location.search);
    if (query) {
      params.set('q', query);
    } else {
      params.delete('q');
    }
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const clearSearch = () => {
    setQuery('');
    const params = new URLSearchParams(location.search);
    params.delete('q');
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const topbarClassName = `topbar${forceCondensed ? ' topbar--condensed' : ''}`;

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleRecipeSelect = (recipe: Recipe) => {
    setShowDropdown(false);
    navigate(`/app/recipes/${recipe.id}`);
  };

  const handleAskAI = async (question: string) => {
    setShowDropdown(false);
    setQuery('');
    setShowChatModal(true);
    await sendMessage(question);
  };

  const userInitials = useMemo(() => getInitials(user?.name ?? user?.email), [user?.name, user?.email]);

  const greeting = useMemo(() => {
    if (!user?.name) {
      return 'Chef IA';
    }
    const firstName = user.name.trim().split(/\s+/)[0];
    return `Ol�, ${firstName}`;
  }, [user?.name]);

  const subheadline = forceCondensed ? 'Modo cozinha ativo' : 'Sua cozinha inteligente';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfile = () => {
    navigate('/app/profile');
  };

  const handleGoHome = () => {
    navigate('/app');
  };

  const themeIsDark = theme === 'dark';
  const themeLabel = themeIsDark ? 'Ativar tema claro' : 'Ativar tema escuro';
  const isDropdownVisible = showDropdown && Boolean(query);

  return (
    <header className={topbarClassName}>
      {isDropdownVisible ? (
        <div className="search-dropdown-backdrop" aria-hidden="true" />
      ) : null}
      <div className="topbar__glass">
        <button type="button" className="topbar__brand" onClick={handleGoHome} aria-label="Ir para a p�gina inicial">
          <span className="topbar__brand-icon">
            <ChefHat size={18} />
          </span>
          <span className="topbar__brand-text">
            <span className="topbar__brand-eyebrow">Chef IA</span>
            <span className="topbar__brand-title">Cozinha viva</span>
          </span>
        </button>

        <div className="topbar__center" role="search" ref={searchAreaRef}>
          <span className="topbar__center-eyebrow">{subheadline}</span>
          <form onSubmit={handleSearch} className="topbar__search">
            <Search size={20} className="topbar__search-icon" />
            <input
              id="recipe-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Busque receitas ou converse com o Chef IA..."
              aria-label="Buscar receitas ou fazer perguntas"
            />
            <div className="topbar__search-actions">
              {query ? (
                <button type="button" className="topbar__clear" onClick={clearSearch}>
                  Limpar
                </button>
              ) : null}
              <button type="submit" className="button button--primary topbar__search-button">
                Pesquisar
              </button>
            </div>
          </form>
          {isDropdownVisible ? (
            <SearchDropdown
              query={query}
              recipes={filteredRecipes}
              isLoading={isLoading}
              onSelectRecipe={handleRecipeSelect}
              onAskAI={handleAskAI}
            />
          ) : null}
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            className="topbar__action topbar__action--ghost"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {themeIsDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            className="topbar__action topbar__action--ghost"
            aria-label="Notifica��es em breve"
            title="Notifica��es em breve"
            disabled
          >
            <Bell size={18} />
          </button>
          <button type="button" className="topbar__profile" onClick={handleProfile} aria-label="Abrir perfil">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="topbar__avatar" />
            ) : (
              <span className="topbar__avatar">{userInitials}</span>
            )}
            <span className="topbar__profile-info">
              <span className="topbar__profile-greeting">{greeting}</span>
              <span className="topbar__profile-meta">Minha conta</span>
            </span>
          </button>
        </div>
      </div>
      <ChatModal isOpen={showChatModal} onClose={() => setShowChatModal(false)} />
    </header>
  );
};

export default TopBar;
