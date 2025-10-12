import { Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

import './layout.css';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { useRecipes } from '../../context/RecipeContext';
import { ChatModal } from '../chat/ChatModal';

const AppLayout = () => {
  const { loadRecipes, recipes, isLoading } = useRecipes();
  const location = useLocation();
  const isCookingMode =
    location.pathname.startsWith('/app/recipes/') && location.pathname.endsWith('/cook');
  const [isChatModalOpen, setChatModalOpen] = useState(false);

  const handleOpenChatModal = useCallback(() => {
    setChatModalOpen(true);
  }, []);

  const handleCloseChatModal = useCallback(() => {
    setChatModalOpen(false);
  }, []);

  useEffect(() => {
    if (!recipes.length && !isLoading) {
      void loadRecipes();
    }
  }, [recipes.length, isLoading, loadRecipes]);

  useEffect(() => {
    handleCloseChatModal();
  }, [handleCloseChatModal, location.pathname, location.search]);

  useEffect(() => {
    if (!isChatModalOpen) {
      return;
    }

    const handleUIInteraction = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest('.topbar__glass') || target.closest('.bottom-nav__inner')) {
        handleCloseChatModal();
      }
    };

    document.addEventListener('click', handleUIInteraction, true);

    return () => {
      document.removeEventListener('click', handleUIInteraction, true);
    };
  }, [handleCloseChatModal, isChatModalOpen]);

  return (
    <>
      <div className={`app-shell${isCookingMode ? ' app-shell--cooking' : ''}`}>
        <div className="header-area">
          <TopBar forceCondensed={isCookingMode} onOpenChatModal={handleOpenChatModal} />
        </div>
        <main className="main-area">
          <Outlet />
        </main>
        {/* A área lateral do chat foi removida daqui */}
      </div>
      {!isCookingMode ? <BottomNav /> : null}
      <ChatModal isOpen={isChatModalOpen} onClose={handleCloseChatModal} />
    </>
  );
};

export default AppLayout;
