import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingView } from './components/LandingView';
import { LoginPage } from './pages/LoginPage';
import { Building2, Loader2 } from 'lucide-react';

// Client Portal (routed app)
import { PortalLayout } from './portal/components/layout/PortalLayout';
import { PublicPortalLayout } from './portal/components/layout/PublicPortalLayout';
import { PORTAL_ROUTES } from './portal/routers/PortalRoutes';
import ClientLoginPage from './portal/pages/ClientLoginPage';
import ClientRegisterPage from './portal/pages/ClientRegisterPage';

// Branch Personnel Portal (routed app)
import StaffLoginPage from './branch/pages/StaffLoginPage';
import BranchRoutes from './branch/routers/BranchRoutes';
import { isBranchStaffRole } from './branch/components/layout/BranchLayout';

import { AdminRoutes } from './admin/router';

/** A staff login with no role the branch app recognises. Roles are set by an administrator. */
const NoStaffRole: React.FC = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">No role assigned</h1>
        <p className="mt-2 text-sm text-slate-600">This staff account has no role yet, so there is nothing it can open. Ask your administrator to assign a role and branch, then sign in again.</p>
        <button onClick={() => logout()} className="mt-5 rounded-xl bg-[#091527] px-4 py-2 text-sm font-bold text-white">Sign out</button>
      </div>
    </div>
  );
};

// Root gate: restores session, shows public landing, blocks app until authenticated, routes by role
const AuthGate: React.FC = () => {
  const { user, isRestoring } = useAuth();
  const navigate = useNavigate();

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-navy-800 to-navy-900 flex items-center justify-center text-white shadow-lg animate-pulse">
          <Building2 className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Restoring secure session…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route
          path="/"
          element={
            <LandingView
              onSignIn={(mode = 'signin') => navigate(mode === 'register' ? '/register' : '/login')}
            />
          }
        />
        <Route
          path="/login"
          element={
            <LoginPage
              onBack={() => navigate('/')}
              onSwitchToRegister={() => navigate('/register')}
              onSuccess={() => navigate('/')}
            />
          }
        />
        <Route path="/register" element={<Navigate to="/portal/register" replace />} />
        <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
        <Route
          path="/portal/login"
          element={
            <PublicPortalLayout>
              <ClientLoginPage />
            </PublicPortalLayout>
          }
        />
        <Route
          path="/portal/register"
          element={
            <PublicPortalLayout>
              <ClientRegisterPage />
            </PublicPortalLayout>
          }
        />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff/*" element={<Navigate to="/staff/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (user.role === 'CLIENT') {
    return (
      <Routes>
        <Route path="/portal" element={<PortalLayout />}>
          {PORTAL_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  if (user.role === 'STAFF' && isBranchStaffRole(user.staffRole)) {
    return <BranchRoutes />;
  }

  return <NoStaffRole />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="*" element={<AuthGate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
