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
  isRefinement?: boolean;
}

// ============================================================================
// SINGLETON WEBSOCKET - Shared across all components to avoid race conditions
// ============================================================================
type WebSocketCallback = (event: WebSocketEvent) => void;

interface SingletonWebSocket {
  ws: WebSocket | null;
  callbacks: Set<WebSocketCallback>;
  isConnecting: boolean;
  isConnected: boolean;
  reconnectAttempts: number;
}

const wsState: SingletonWebSocket = {
  ws: null,
  callbacks: new Set(),
  isConnecting: false,
  isConnected: false,
  reconnectAttempts: 0,
};

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

// Promise resolvers for waiting on connection
let connectionResolvers: Array<() => void> = [];

/**
 * Wait for the WebSocket to be connected
 * Resolves immediately if already connected
 */
export function waitForWebSocketConnection(timeoutMs: number = 5000): Promise<void> {
  if (wsState.isConnected) {
    console.log('[WS Singleton] Already connected');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = connectionResolvers.indexOf(resolve);
      if (index > -1) connectionResolvers.splice(index, 1);
      reject(new Error('WebSocket connection timeout'));
    }, timeoutMs);

    connectionResolvers.push(() => {
      clearTimeout(timeout);
      resolve();
    });

    // Ensure connection is being attempted
    if (!wsState.isConnecting && !wsState.isConnected) {
      connectSingletonWebSocket();
    }
  });
}

function connectSingletonWebSocket() {
  if (wsState.isConnecting || wsState.isConnected) {
    console.log('[WS Singleton] Already connected or connecting');
    return;
  }

  wsState.isConnecting = true;
  console.log('[WS Singleton] Connecting to ws://localhost:5174...');

  const ws = new WebSocket('ws://localhost:5174');
  wsState.ws = ws;

  ws.onopen = () => {
    console.log('[WS Singleton] Connected! Callbacks registered:', wsState.callbacks.size);
    wsState.isConnected = true;
    wsState.isConnecting = false;
    wsState.reconnectAttempts = 0;

    // Resolve any pending connection promises
    connectionResolvers.forEach(resolve => resolve());
    connectionResolvers = [];
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WebSocketEvent;

      // Debug log for headless events
      if (data.type.startsWith('headless_')) {
        console.log('[WS Singleton] Received headless event:', data.type, 'phase:', data.phase, 'callbacks:', wsState.callbacks.size);
      }

      // Dispatch to all registered callbacks
      wsState.callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WS Singleton] Error in callback:', error);
        }
      });
    } catch (error) {
      console.error('[WS Singleton] Error parsing message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('[WS Singleton] WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('[WS Singleton] Disconnected');
    wsState.isConnected = false;
    wsState.isConnecting = false;
    wsState.ws = null;

    // Auto-reconnect if we have callbacks and haven't exceeded attempts
    if (wsState.callbacks.size > 0 && wsState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      wsState.reconnectAttempts++;
      console.log(`[WS Singleton] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${wsState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(connectSingletonWebSocket, RECONNECT_DELAY);
    }
  };
}

function registerCallback(callback: WebSocketCallback) {
  wsState.callbacks.add(callback);
  console.log('[WS Singleton] Callback registered, total:', wsState.callbacks.size);

  // Ensure connection is established
  if (!wsState.isConnected && !wsState.isConnecting) {
    connectSingletonWebSocket();
  }
}

function unregisterCallback(callback: WebSocketCallback) {
  wsState.callbacks.delete(callback);
  console.log('[WS Singleton] Callback unregistered, remaining:', wsState.callbacks.size);
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for real-time updates via WebSocket
 * Uses a singleton WebSocket connection shared across all components
 * @param onUpdate - Callback that receives the event data
 * @param enableNotifications - Whether to show tab notifications
 */
export function useRealtimeUpdates(onUpdate: (event: WebSocketEvent) => void, enableNotifications: boolean = true) {
  // Use a ref to store the callback so we don't re-register on every render
  const callbackRef = useRef(onUpdate);

  // Update the ref when callback changes
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // Create a stable callback that uses the ref
    const stableCallback: WebSocketCallback = (data) => {
      // Handle tab notifications
      if ((data.type === 'file_changed' || data.type === 'file_added') && enableNotifications && document.hidden) {
        notifyInTab('✅ Updated');
      }

      // Log headless events for debugging
      if (data.type.startsWith('headless_')) {
        logger.debug('Headless event:', data);
      }

      // Call the actual callback
      callbackRef.current(data);
    };

    // Register with singleton
    registerCallback(stableCallback);

    // Clear notification when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        clearTabNotification();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      unregisterCallback(stableCallback);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTabNotification();
    };
  }, [enableNotifications]);
}

