import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { RecipeProvider } from './context/RecipeContext';

import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RecipeProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </RecipeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
