import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, type AuthScope } from './context/AuthContext';
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

/** Where each site starts, and how the home page offers it to someone signed in there. */
const SITE_HOME: Readonly<Record<AuthScope, { path: string; label: string }>> = {
  member: { path: '/portal', label: 'Go to my account' },
  staff: { path: '/staff/app', label: 'Go to the staff app' },
  admin: { path: '/admin', label: 'Go to the admin console' },
};

const Restoring: React.FC = () => (
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

/**
 * Registration is open whether or not a member is signed in on this device (the
 * page says who is, and registering replaces that session). The same element in
 * both route trees keeps the page, and its success screen, when the new
 * account signs in.
 */
const REGISTER_PAGE = (
  <PublicPortalLayout>
    <ClientRegisterPage />
  </PublicPortalLayout>
);

/**
 * The member portal: only the member session counts here, never a staff or admin one.
 * Mounted at /portal/*, so paths here are relative to /portal.
 */
const MemberSite: React.FC = () => {
  const { user, isRestoring } = useAuth();
  if (isRestoring) return <Restoring />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<PublicPortalLayout><ClientLoginPage /></PublicPortalLayout>} />
        <Route path="/register" element={REGISTER_PAGE} />
        <Route path="*" element={<Navigate to="/portal/login" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/portal" replace />} />
      <Route path="/register" element={REGISTER_PAGE} />
      <Route path="/" element={<PortalLayout />}>
        {PORTAL_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
};

/** The staff app: only the staff session counts here. Mounted at /staff/*, so paths are relative to /staff. */
const StaffSite: React.FC = () => {
  const { user, isRestoring } = useAuth();
  if (isRestoring) return <Restoring />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<StaffLoginPage />} />
        <Route path="*" element={<Navigate to="/staff/login" replace />} />
      </Routes>
    );
  }
  return isBranchStaffRole(user.staffRole) ? <BranchRoutes /> : <NoStaffRole />;
};

/** The public pages: they hold no session of their own and only offer the sites you are signed in to. */
const PublicSite: React.FC = () => {
  const { sessions, lastSignedIn, isRestoring } = useAuth();
  const navigate = useNavigate();
  if (isRestoring) return <Restoring />;
  const signedIn = (['member', 'staff', 'admin'] as const).filter((s) => sessions[s]);
  const offer = signedIn[0];
  const after = lastSignedIn ?? offer;
  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingView
            onSignIn={(mode = 'signin') => navigate(mode === 'register' ? '/portal/register' : '/login')}
            account={offer ? { label: SITE_HOME[offer].label, onOpen: () => navigate(SITE_HOME[offer].path) } : undefined}
          />
        }
      />
      <Route path="/login" element={<LoginPage onBack={() => navigate('/')} onSwitchToRegister={() => navigate('/portal/register')} onSuccess={() => navigate('/app', { replace: true })} />} />
      <Route path="/register" element={<Navigate to="/portal/register" replace />} />
      {/* After the general sign-in: the site the account just signed in to. */}
      <Route path="/app" element={<Navigate to={after ? SITE_HOME[after].path : '/'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="/portal/*" element={<MemberSite />} />
          <Route path="/staff/*" element={<StaffSite />} />
          <Route path="*" element={<PublicSite />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
