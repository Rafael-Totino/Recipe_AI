import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import ChatDock from '../chat/ChatDock';
import './layout.css';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useRecipes } from '../../context/RecipeContext';

const AppLayout = () => {
  const { loadRecipes, recipes, isLoading } = useRecipes();
  const location = useLocation();
  const isCookingMode =
    location.pathname.startsWith('/app/recipes/') && location.pathname.endsWith('/cook');

  useEffect(() => {
    if (!recipes.length && !isLoading) {
      void loadRecipes();
    }
  }, [recipes.length, isLoading, loadRecipes]);

  return (
    <div className={`app-shell${isCookingMode ? ' app-shell--cooking' : ''}`}>
      {!isCookingMode ? (
        <div className="sidebar-area">
          <Sidebar />
        </div>
      ) : null}
      <div className="header-area">
        <TopBar forceCondensed={isCookingMode} />
      </div>
      <main className="main-area">
        <Outlet />
      </main>
      {!isCookingMode ? (
        <aside className="chat-area">
          <ChatDock />
        </aside>
      ) : null}
    </div>
  );
};

export default AppLayout;
