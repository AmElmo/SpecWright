import { createContext, useContext, useState, type ReactNode } from 'react';

interface Issue {
  issueId: string;
  title: string;
  projectId: string;
  projectName: string;
}

interface ShipModalContextType {
  isOpen: boolean;
  issue: Issue | null;
  openShipModal: (issue: Issue) => void;
  closeShipModal: () => void;
}

const ShipModalContext = createContext<ShipModalContextType | null>(null);

export function ShipModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);

  const openShipModal = (issueToShip: Issue) => {
    setIssue(issueToShip);
    setIsOpen(true);
  };

  const closeShipModal = () => {
    setIsOpen(false);
    setIssue(null);
  };

  return (
    <ShipModalContext.Provider value={{ isOpen, issue, openShipModal, closeShipModal }}>
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
