import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PendingReviewPage from './pages/PendingReviewPage';
import SessionDetailPage from './pages/SessionDetailPage';
import InspectionsPage from './pages/InspectionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MachinesPage from './pages/MachinesPage';
import MachineDetailPage from './pages/MachineDetailPage';
import UsersPage from './pages/UsersPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import { getPendingSessions } from './api/inspections';

const PLANT_ID = 1;

function ProtectedLayout({ children, pendingCount, onPendingCountChange }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner message="Checking authentication..." />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <WebSocketProvider plantId={PLANT_ID}>
      <div className="app-layout">
        <Sidebar pendingCount={pendingCount} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </WebSocketProvider>
  );
}

export default function App() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll for pending counts to show on the sidebar badge
  const updatePendingCount = async () => {
    if (!user) return;
    try {
      const res = await getPendingSessions();
      setPendingCount(res.data?.length ?? 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (user) {
      updatePendingCount();
      const interval = setInterval(updatePendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedLayout pendingCount={pendingCount} onPendingCountChange={setPendingCount}>
            <DashboardPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/pending"
        element={
          <ProtectedLayout pendingCount={pendingCount} onPendingCountChange={setPendingCount}>
            <PendingReviewPage onPendingCountChange={setPendingCount} />
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
        path="/users"
        element={
          <ProtectedLayout pendingCount={pendingCount}>
            <UsersPage />
          </ProtectedLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
