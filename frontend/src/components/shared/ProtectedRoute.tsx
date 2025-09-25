import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

import { useAuth } from '../../context/AuthContext';
import Loader from './Loader';
import '../../index.css';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Loader />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
