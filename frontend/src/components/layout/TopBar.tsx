import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useRecipes } from '../../context/RecipeContext';
import './layout.css';
import { useTheme } from '../../context/ThemeContext';

type TopBarProps = {
  forceCondensed?: boolean;
};

const TopBar = ({ forceCondensed = false }: TopBarProps) => {
  const { user, logout } = useAuth();
  const { recipes } = useRecipes();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [isCondensed, setIsCondensed] = useState(forceCondensed);
  const condensedRef = useRef(isCondensed);

  useEffect(() => {
    condensedRef.current = isCondensed;
  }, [isCondensed]);

  useEffect(() => {
    if (forceCondensed) {
      setIsCondensed(true);
      condensedRef.current = true;
      return;
    }

    const shouldCondense = window.scrollY >= 32;
    setIsCondensed(shouldCondense);
    condensedRef.current = shouldCondense;
  }, [forceCondensed]);

  const favoriteCount = useMemo(
    () => recipes.filter((recipe) => recipe.isFavorite).length,
    [recipes]
  );

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

  useEffect(() => {
    if (forceCondensed) {
      return;
    }

    const condenseThreshold = 32;
    const releaseThreshold = 16;
    const releaseHysteresis = 110;
    const releaseCooldownMs = 250;

    let ticking = false;
    let lastScrollY = window.scrollY;
    let lastDirection: 'up' | 'down' | 'none' = 'none';
    let condensedAnchor = window.scrollY;
    let releaseCooldownUntil = 0;

    const applyCondensed = (next: boolean) => {
      if (condensedRef.current === next) {
        return;
      }

      condensedRef.current = next;
      setIsCondensed(next);

      if (next) {
        releaseCooldownUntil = performance.now() + releaseCooldownMs;
      }
    };

    const updateCondensedState = () => {
      const { scrollY } = window;
      const delta = scrollY - lastScrollY;
      const direction =
        Math.abs(delta) <= 2
          ? lastDirection
          : delta > 0
            ? 'down'
            : 'up';

      if (!condensedRef.current) {
        if (direction === 'down' && scrollY >= condenseThreshold) {
          condensedAnchor = scrollY;
          applyCondensed(true);
        }
      } else {
        if (direction === 'down' && scrollY > condensedAnchor) {
          condensedAnchor = scrollY;
        }

        if (direction === 'up' && condensedAnchor - scrollY >= releaseHysteresis) {
          condensedAnchor = scrollY;
          applyCondensed(false);
        } else if (scrollY <= releaseThreshold && performance.now() > releaseCooldownUntil) {
          condensedAnchor = scrollY;
          applyCondensed(false);
        }
      }

      lastDirection = direction;
      lastScrollY = scrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateCondensedState);
    };

    updateCondensedState();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [forceCondensed]);

  const firstName = user?.name?.split(' ')[0] ?? 'Chef';
  const timeOfDay = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <header className={`topbar${isCondensed ? ' topbar--condensed' : ''}`}>
      <div className="topbar__glass">
        <div className="topbar__intro">
          <p className="topbar__greeting">{timeOfDay}, {firstName}!</p>
          <p className="topbar__subtitle">
            Seu atelier está organizado, com {recipes.length} receitas prontas para ganhar uma nova releitura.
          </p>
        </div>

        <div className="topbar__stats" aria-label="Resumo das receitas">
          <span className="topbar__badge">{recipes.length} receitas</span>
          <span className="topbar__badge">{favoriteCount} favoritas</span>
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            onClick={toggleTheme}
            className="button button--ghost topbar__theme-toggle"
            aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
            title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            <span aria-hidden="true">{theme === 'dark' ? '🌞' : '🌙'}</span>
          </button>
          <button type="button" onClick={logout} className="button button--ghost topbar__logout">
            Sair
          </button>
        </div>

        <form onSubmit={handleSearch} className="topbar__search" role="search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque receitas ou peça uma nova criação ao atelier"
            aria-label="Buscar receitas"
          />
          <button type="submit" className="button button--primary topbar__search-button">
            Pesquisar
          </button>
        </form>
      </div>
    </header>
  );
};

export default TopBar;
