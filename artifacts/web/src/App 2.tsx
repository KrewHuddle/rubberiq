import { Navigate, Route, Routes } from 'react-router-dom';
import { usePrincipal, type Principal } from './principal.js';
import { SignInPage } from './pages/SignInPage.js';
import { ShopDashboardPage } from './pages/ShopDashboardPage.js';
import { IntakePage } from './pages/IntakePage.js';
import { SuperAdminPage } from './pages/SuperAdminPage.js';
import { SalesPage } from './pages/SalesPage.js';
import { AppShell } from './components/AppShell.js';

function RoleGate({
  principal,
  allow,
  children,
}: {
  principal: Principal | null;
  allow: (p: Principal) => boolean;
  children: React.ReactNode;
}) {
  if (!principal) return <Navigate to="/sign-in" replace />;
  if (!allow(principal)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const principal = usePrincipal();

  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />

      <Route element={<AppShell principal={principal} />}>
        <Route path="/" element={<HomeRedirect principal={principal} />} />

        <Route
          path="/dashboard"
          element={
            <RoleGate principal={principal} allow={(p) => p.kind === 'user'}>
              <ShopDashboardPage />
            </RoleGate>
          }
        />
        <Route
          path="/intake"
          element={
            <RoleGate principal={principal} allow={(p) => p.kind === 'user'}>
              <IntakePage />
            </RoleGate>
          }
        />

        <Route
          path="/admin/*"
          element={
            <RoleGate
              principal={principal}
              allow={(p) => p.kind === 'platform' && p.role === 'super_admin'}
            >
              <SuperAdminPage />
            </RoleGate>
          }
        />
        <Route
          path="/sales/*"
          element={
            <RoleGate
              principal={principal}
              allow={(p) =>
                p.kind === 'platform' && (p.role === 'sales_agent' || p.role === 'super_admin')
              }
            >
              <SalesPage />
            </RoleGate>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function HomeRedirect({ principal }: { principal: Principal | null }) {
  if (!principal) return <Navigate to="/sign-in" replace />;
  if (principal.kind === 'platform' && principal.role === 'super_admin')
    return <Navigate to="/admin" replace />;
  if (principal.kind === 'platform' && principal.role === 'sales_agent')
    return <Navigate to="/sales" replace />;
  return <Navigate to="/dashboard" replace />;
}
