import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRealtimeUpdates } from './use-realtime';

interface ActiveGeneration {
  key: string;
  phase: string;
  projectId?: string;
  projectName?: string;
  startedAt: string;
}

interface ActiveGenerationsContextType {
  activeGenerations: ActiveGeneration[];
  hasActiveGenerations: boolean;
}

const ActiveGenerationsContext = createContext<ActiveGenerationsContextType | null>(null);

const POLL_INTERVAL_MS = 5000;

export function ActiveGenerationsProvider({ children }: { children: ReactNode }) {
  const [activeGenerations, setActiveGenerations] = useState<ActiveGeneration[]>([]);

  const fetchActiveGenerations = useCallback(async () => {
    try {
      const response = await fetch('/api/generations/active');
      if (response.ok) {
        const data = await response.json();
        setActiveGenerations(data.generations || []);
      }
    } catch {
      // Silently fail — server may not be ready yet
    }
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    fetchActiveGenerations();
    const interval = setInterval(fetchActiveGenerations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchActiveGenerations]);

  // Re-poll immediately on relevant WebSocket events
  useRealtimeUpdates(
    useCallback(
      (event) => {
        if (
          event.type === 'headless_started' ||
          event.type === 'headless_completed' ||
          event.type === 'file_changed' ||
          event.type === 'file_added'
        ) {
          fetchActiveGenerations();
        }
      },
      [fetchActiveGenerations]
    ),
    false
  );

  return (
    <ActiveGenerationsContext.Provider
      value={{ activeGenerations, hasActiveGenerations: activeGenerations.length > 0 }}
    >
      {children}
    </ActiveGenerationsContext.Provider>
  );
}

export function useActiveGenerations() {
  const context = useContext(ActiveGenerationsContext);
  if (!context) {
    throw new Error('useActiveGenerations must be used within an ActiveGenerationsProvider');
  }
  return context;
}
