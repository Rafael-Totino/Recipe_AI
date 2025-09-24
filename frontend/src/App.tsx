import { Navigate, Route, Routes } from 'react-router-dom';

import AuthLayout from './components/auth/AuthLayout';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import HomePage from './pages/HomePage';
import ImportRecipePage from './pages/ImportRecipePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import SettingsPage from './pages/SettingsPage';

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
        <Route path="import" element={<ImportRecipePage />} />
        <Route path="recipes/:recipeId" element={<RecipeDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
