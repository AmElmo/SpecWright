import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AITool } from './use-ai-tool';

interface Issue {
  issueId: string;
  title: string;
  projectId: string;
  projectName: string;
}

interface ShipModalContextType {
  isOpen: boolean;
  issue: Issue | null;
  aiToolOverride: AITool | null;
  openShipModal: (issue: Issue, aiToolOverride?: AITool) => void;
  closeShipModal: () => void;
}

const ShipModalContext = createContext<ShipModalContextType | null>(null);

export function ShipModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [aiToolOverride, setAiToolOverride] = useState<AITool | null>(null);

  const openShipModal = (issueToShip: Issue, toolOverride?: AITool) => {
    setIssue(issueToShip);
    setAiToolOverride(toolOverride || null);
    setIsOpen(true);
  };

  const closeShipModal = () => {
    setIsOpen(false);
    setIssue(null);
    setAiToolOverride(null);
  };

  return (
    <ShipModalContext.Provider value={{ isOpen, issue, aiToolOverride, openShipModal, closeShipModal }}>
      {children}
    </ShipModalContext.Provider>
  );
}

export function useShipModal() {
  const context = useContext(ShipModalContext);
  if (!context) {
    throw new Error('useShipModal must be used within a ShipModalProvider');
  }
  return context;
}
