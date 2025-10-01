import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import './layout.css';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
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
    <>
      <div className={`app-shell${isCookingMode ? ' app-shell--cooking' : ''}`}>
        <div className="header-area">
          <TopBar forceCondensed={isCookingMode} />
        </div>
        <main className="main-area">
          <Outlet />
        </main>
        {/* A área lateral do chat foi removida daqui */}
      </div>
      {!isCookingMode ? <BottomNav /> : null}
    </>
  );
};

export default AppLayout;
