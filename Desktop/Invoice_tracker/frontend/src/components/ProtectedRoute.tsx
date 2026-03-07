import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface Props { roles?: Role[] }

export default function ProtectedRoute({ roles }: Props) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'EXECUTIVE' ? '/me/outstanding' : '/outstanding'} replace />;
  }
  return <Outlet />;
}
