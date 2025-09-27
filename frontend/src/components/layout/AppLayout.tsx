import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';

import ChatDock from '../chat/ChatDock';
import './layout.css';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useRecipes } from '../../context/RecipeContext';

const AppLayout = () => {
  const { loadRecipes, recipes, isLoading } = useRecipes();

  useEffect(() => {
    if (!recipes.length && !isLoading) {
      void loadRecipes();
    }
  }, [recipes.length, isLoading, loadRecipes]);

  return (
    <div className="app-shell">
      <div className="sidebar-area">
        <Sidebar />
      </div>
      <div className="header-area">
        <TopBar />
      </div>
      <main className="main-area">
        <Outlet />
      </main>
      <aside className="chat-area">
        <ChatDock />
      </aside>
    </div>
  );
};

export default AppLayout;
