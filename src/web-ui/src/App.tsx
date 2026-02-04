import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ProjectDetail } from './components/ProjectDetail';
import { CreateProject } from './components/CreateProject';
import { Specification } from './components/Specification';
import { Breakdown } from './components/Breakdown';
import { IssueBoard } from './components/IssueBoard';
import { Settings } from './components/Settings';
import { Onboarding } from './components/Onboarding';
import { InitializationSuccess } from './components/InitializationSuccess';
import { HowItWorks } from './components/HowItWorks';
import { Playbook } from './components/Playbook';
import Canvas from './__Canvas';
import { ShipModalProvider, useShipModal } from './lib/ship-modal-context';
import { ShipModal } from './components/ShipModal';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// App-level ShipModal that's isolated from route component re-renders
function AppShipModal() {
  const { isOpen, issue, closeShipModal } = useShipModal();
  return <ShipModal isOpen={isOpen} issue={issue} onClose={closeShipModal} />;
}

export default function App() {
  return (
    <ShipModalProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/initialization-success" element={<InitializationSuccess />} />
        <Route path="/create-project" element={<CreateProject />} />
        <Route path="/specification/:projectId" element={<Specification />} />
        <Route path="/breakdown/:projectId" element={<Breakdown />} />
        {/* Project detail with nested routes for issues and docs */}
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/project/:id/:section" element={<ProjectDetail />} />
        <Route path="/project/:id/:section/:docType" element={<ProjectDetail />} />
        <Route path="/issues" element={<IssueBoard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/customise" element={<Navigate to="/settings" replace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/playbook" element={<Playbook />} />
        <Route path="/__preview" element={<Canvas />} />
      </Routes>
      {/* ShipModal rendered at App level, isolated from route re-renders */}
      <AppShipModal />
    </ShipModalProvider>
  );
}

