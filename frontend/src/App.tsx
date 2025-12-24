import { Navigate, Route, Routes } from 'react-router-dom';

import AuthLayout from './components/auth/AuthLayout';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import CookingModePage from './pages/CookingModePage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import ImportLinkPage from './pages/ImportLinkPage';
import ImportManualPage from './pages/ImportManualPage';
import PlaylistsPage from './pages/PlaylistsPage';
import PlaylistDetailPage from './pages/PlaylistDetailPage';

const App = () => {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/app" replace />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="recipes/:recipeId" element={<RecipeDetailPage />} />
        <Route path="recipes/:recipeId/cook" element={<CookingModePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="import/link" element={<ImportLinkPage />} />
        <Route path="import/manual" element={<ImportManualPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/:playlistId" element={<PlaylistDetailPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
