import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChefHat, MessageCircle, Moon, Search, Sun } from 'lucide-react';

import { SearchDropdown } from './SearchDropdown';
import { useRecipes } from '../../context/RecipeContext';
import type { Recipe } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

import './layout.css';

type TopBarProps = {
  forceCondensed?: boolean;
  onOpenChatModal?: () => void;
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

const TopBar = ({ forceCondensed, onOpenChatModal }: TopBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    searchResults,
    searchTerm,
    searchTotal,
    isSearching,
    hasMoreSearchResults,
    loadMoreSearchResults,
    searchRecipes: requestSearch,
    resetSearch
  } = useRecipes();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') ?? '';
  });
  const searchAreaRef = useRef<HTMLDivElement>(null);

  const handleOpenChatModal = useCallback(() => {
    onOpenChatModal?.();
  }, [onOpenChatModal]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextQuery = params.get('q') ?? '';
    setQuery((current) => (current === nextQuery ? current : nextQuery));
  }, [location.search]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      if (searchTerm || searchResults.length) {
        resetSearch();
      }
      return;
    }

    if (trimmed === searchTerm) {
      return;
    }

    const handle = window.setTimeout(() => {
      void requestSearch(trimmed);
    }, 350);

    return () => window.clearTimeout(handle);
  }, [query, requestSearch, resetSearch, searchResults.length, searchTerm]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(location.search);
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      params.set('q', trimmedQuery);
    } else {
      params.delete('q');
    }
    navigate({ pathname: location.pathname, search: params.toString() });
    if (trimmedQuery.length >= 2) {
      void requestSearch(trimmedQuery);
    } else {
      resetSearch();
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    const params = new URLSearchParams(location.search);
    params.delete('q');
    navigate({ pathname: location.pathname, search: params.toString() });
    resetSearch();
  };

  const topbarClassName = `topbar${forceCondensed ? ' topbar--condensed' : ''}`;

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;
  const displayedRecipes = canSearch ? searchResults : [];
  const totalResults = canSearch ? searchTotal : 0;
  const dropdownLoading = canSearch ? isSearching : false;

  const handleRecipeSelect = (recipe: Recipe) => {
    setShowDropdown(false);
    navigate(`/app/recipes/${recipe.id}`);
  };

  const handleAskAI = async (question: string) => {
    setShowDropdown(false);
    navigate('/app/chat', { state: { prompt: question } });
  };

  const handleLoadMoreResults = () => {
    void loadMoreSearchResults();
  };

  const userInitials = useMemo(() => getInitials(user?.name ?? user?.email), [user?.name, user?.email]);

  const greeting = useMemo(() => {
    if (!user?.name) {
      return 'Chef IA';
    }
    const firstName = user.name.trim().split(/\s+/)[0];
    return `Chef ${firstName}`;
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
  const hasQuery = trimmedQuery.length > 0;
  const isDropdownVisible = showDropdown && hasQuery;

  return (
    <header className={topbarClassName}>
      {isDropdownVisible ? (
        <div className="search-dropdown-backdrop" aria-hidden="true" />
      ) : null}
      <div className="topbar__glass">
        <div className="topbar__header">
          <div className="topbar__identity">
            <button
              type="button"
              className="topbar__brand"
              onClick={handleGoHome}
              aria-label="Ir para a pgina inicial"
            >
              <span className="topbar__brand-icon">
                <ChefHat size={18} />
              </span>
              <span className="topbar__brand-text">
                <span className="topbar__brand-eyebrow">Chef IA</span>
                <span className="topbar__brand-title">Cozinha viva</span>
              </span>
            </button>
            <span className="topbar__center-eyebrow">{subheadline}</span>
          </div>

          <div className="topbar__header-actions">
            <div className="topbar__actions">
              <button
                type="button"
                className="topbar__action topbar__action--highlight"
                onClick={handleOpenChatModal}
                aria-label="Abrir o assistente Chef IA"
              >
                <MessageCircle size={18} />
                <span>Chef IA</span>
              </button>
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
                aria-label="Notificaes em breve"
                title="Notificaes em breve"
                disabled
              >
                <Bell size={18} />
              </button>
            </div>
            <button
              type="button"
              className="topbar__profile"
              onClick={handleProfile}
              aria-label="Abrir perfil"
            >
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
            <button
              type="button"
              className="topbar__profile-badge"
              onClick={handleProfile}
              aria-label="Abrir perfil"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="topbar__profile-badge-img" />
              ) : (
                <span aria-hidden="true">{userInitials}</span>
              )}
            </button>
          </div>
        </div>

        <div className="topbar__center" role="search" ref={searchAreaRef}>
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
              placeholder="Buscar receitas ou falar com Chef IA..."
              aria-label="Buscar receitas ou fazer perguntas"
            />
            <div className="topbar__search-actions">
              {query ? (
                <button type="button" className="topbar__clear" onClick={handleClearSearch}>
                  Limpar
                </button>
              ) : null}
              <button type="submit" className="button button--primary topbar__search-button">
                <Search aria-hidden="true" className="topbar__search-button-icon" size={18} />
                <span className="sr-only">Pesquisar</span>
              </button>
            </div>
          </form>
          {isDropdownVisible ? (
            <SearchDropdown
              query={query}
              recipes={displayedRecipes}
              total={totalResults}
              canSearch={canSearch}
              isLoading={dropdownLoading}
              hasMore={canSearch && hasMoreSearchResults}
              onLoadMore={canSearch && hasMoreSearchResults ? handleLoadMoreResults : undefined}
              onSelectRecipe={handleRecipeSelect}
              onAskAI={handleAskAI}
            />
          ) : null}
        </div>

      </div>
    </header>
  );
};

export default TopBar;
