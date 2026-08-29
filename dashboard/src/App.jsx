import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import SessionDetailPage from './pages/SessionDetailPage';
import InspectionsPage from './pages/InspectionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportsHubPage from './pages/ReportsHubPage';
import SetupApprovalReportsPage from './pages/SetupApprovalReportsPage';
import DailyProductionReportsPage from './pages/DailyProductionReportsPage';
import DowntimeReportsPage from './pages/DowntimeReportsPage';
import ProductionModulePage from './pages/ProductionModulePage';
import MachinesPage from './pages/MachinesPage';
import MachineDetailPage from './pages/MachineDetailPage';
import ParametersPage from './pages/ParametersPage';
import UsersPage from './pages/UsersPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import { getPendingSessions } from './api/inspections';

const PLANT_ID = 1;
const CALIBRATOR_ROLE = 'calibrator';
const CALIBRATOR_ONLY = [CALIBRATOR_ROLE];
const CalibrationPage = lazy(() => import('./pages/CalibrationPage'));

function ProtectedLayout({ children, pendingCount, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner message="Checking authentication..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  if (!allowedRoles && user.role === CALIBRATOR_ROLE) return <Navigate to="/calibration" replace />;

  const layout = (
    <div className="app-layout">
      <Sidebar pendingCount={pendingCount} />
      <main className="main-content">
        <Suspense fallback={<LoadingSpinner message="Loading module..." />}>
          {children}
        </Suspense>
      </main>
    </div>
  );

  return user.role === CALIBRATOR_ROLE
    ? layout
    : <WebSocketProvider plantId={PLANT_ID}>{layout}</WebSocketProvider>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Redirecting..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === CALIBRATOR_ROLE) return <Navigate to="/calibration" replace />;
  if (user.role === 'admin') return <Navigate to="/users" replace />;
  return <Navigate to="/reports" replace />;
}

export default function App() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user || user.role === CALIBRATOR_ROLE) {
      setPendingCount(0);
      return;
    }

    const updatePendingCount = async () => {
      try {
        const res = await getPendingSessions();
        setPendingCount(res.data?.length ?? 0);
      } catch { /* ignore */ }
    };
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/"
        element={<RootRedirect />}
      />
      <Route
        path="/pending"
        element={<RootRedirect />}
      />
      <Route
        path="/reports"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <ReportsHubPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/reports/setup-approval"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <SetupApprovalReportsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/reports/daily-production"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <DailyProductionReportsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/reports/downtime"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <DowntimeReportsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/production"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <ProductionModulePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/inspections"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <InspectionsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/inspections/:sessionId"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <SessionDetailPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <AnalyticsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/machines"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <MachinesPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/machines/:machineId"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <MachineDetailPage />
          </ProtectedLayout>
        }
      />
      
      <Route
        path="/parameters"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <ParametersPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <UsersPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/calibration"
        element={
          <ProtectedLayout pendingCount={pendingCount} allowedRoles={CALIBRATOR_ONLY}>
            <CalibrationPage view="dashboard" />
          </ProtectedLayout>
        }
      />

      <Route
        path="/calibration/equipment"
        element={
          <ProtectedLayout pendingCount={pendingCount} allowedRoles={CALIBRATOR_ONLY}>
            <CalibrationPage view="equipment" />
          </ProtectedLayout>
        }
      />

      <Route
        path="/calibration/equipment/new"
        element={
          <ProtectedLayout pendingCount={pendingCount} allowedRoles={CALIBRATOR_ONLY}>
            <CalibrationPage view="register" />
          </ProtectedLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
