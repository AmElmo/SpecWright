import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { notifyInTab, clearTabNotification } from './notification-utils';

// Re-export notification utilities for convenience
export { notifyInTab, clearTabNotification };

/**
 * WebSocket event data type
 */
export interface WebSocketEvent {
  type: string;
  path?: string;
  status?: string;
  tool?: string;
  success?: boolean;
  phase?: string;
  timestamp?: number;
  sessionId?: string;
}

/**
 * Hook for real-time updates via WebSocket
 * Connects to the WebSocket server and calls onUpdate when events occur
 * @param onUpdate - Callback that receives the event data
 * @param enableNotifications - Whether to show tab notifications
 */
export function useRealtimeUpdates(onUpdate: (event: WebSocketEvent) => void, enableNotifications: boolean = true) {
  // Use a ref to store the callback so we don't reconnect on every render
  const callbackRef = useRef(onUpdate);

  // Update the ref when callback changes (without reconnecting)
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // Connect to WebSocket server (only once)
    // Use port 5174 to match the web server port
    const ws = new WebSocket('ws://localhost:5174');

    ws.onopen = () => {
      logger.debug('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;

        // Log all events for debugging
        if (data.type.startsWith('headless_')) {
          logger.debug('Headless event:', data);
        }

        // Trigger tab title notification for file changes
        if ((data.type === 'file_changed' || data.type === 'file_added') && enableNotifications && document.hidden) {
          notifyInTab('✅ Updated');
        }

        // Always call the callback with the event data
        callbackRef.current(data);
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      logger.debug('WebSocket disconnected');
    };
    
    // Clear notification when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearTabNotification();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTabNotification();
    };
  }, [enableNotifications]); // Re-connect if notification setting changes
}

