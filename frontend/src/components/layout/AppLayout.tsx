import { Outlet } from 'react-router-dom';

import ChatDock from '../chat/ChatDock';
import './layout.css';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const AppLayout = () => {
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
