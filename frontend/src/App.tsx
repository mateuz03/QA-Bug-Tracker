import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './contexts/AuthContext';
import { BugFormPage } from './pages/BugFormPage';
import { BugListPage } from './pages/BugListPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExecutionDetailPage } from './pages/ExecutionDetailPage';
import { ExecutionsPage } from './pages/ExecutionsPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RecorderPage } from './pages/RecorderPage';
import { ScenarioDetailPage } from './pages/ScenarioDetailPage';
import { ScenarioFormPage } from './pages/ScenarioFormPage';
import { ScenariosPage } from './pages/ScenariosPage';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-loading">Preparando seu workspace...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projetos" element={<ProjectsPage />} />
        <Route path="/projetos/:id" element={<ProjectDetailPage />} />
        <Route path="/cenarios" element={<ScenariosPage />} />
        <Route path="/cenarios/novo" element={<ScenarioFormPage />} />
        <Route path="/cenarios/:id" element={<ScenarioDetailPage />} />
        <Route path="/cenarios/:id/editar" element={<ScenarioFormPage />} />
        <Route path="/execucoes" element={<ExecutionsPage />} />
        <Route path="/execucoes/:id" element={<ExecutionDetailPage />} />
        <Route path="/gravador" element={<RecorderPage />} />
        <Route path="/bugs" element={<BugListPage />} />
        <Route path="/bugs/novo" element={<BugFormPage />} />
        <Route path="/bugs/:id/editar" element={<BugFormPage />} />
        <Route path="/usuarios" element={<PlaceholderPage title="Usuários" />} />
        <Route path="/configuracoes" element={<PlaceholderPage title="Configurações" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
