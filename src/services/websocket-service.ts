/**
 * WebSocket Service - Centralized WebSocket broadcasting
 *
 * This service provides a way for any module to broadcast messages
 * to connected WebSocket clients without needing direct access to the WSS instance.
 */

import type { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

// Module-level reference to the WebSocket server
let wss: WebSocketServer | null = null;

/**
 * Initialize the WebSocket service with the server instance
 */
export function initWebSocketService(wsServer: WebSocketServer): void {
    wss = wsServer;
    logger.debug('📡 WebSocket service initialized');
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(type: string, data: Record<string, unknown>): void {
    console.log(`[WS Broadcast] type=${type}, wss initialized=${!!wss}`);

    if (!wss) {
        console.log('[WS Broadcast] ⚠️ WebSocket service not initialized, cannot broadcast');
        logger.debug('⚠️ WebSocket service not initialized, cannot broadcast');
        return;
    }

    const message = JSON.stringify({ type, ...data, timestamp: Date.now() });
    let clientCount = 0;

    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
            clientCount++;
        }
    });

    console.log(`[WS Broadcast] Sent ${type} to ${clientCount} client(s)`);
    if (clientCount > 0) {
        logger.debug(`📡 [WebSocket] Broadcasted ${type} to ${clientCount} client(s)`);
    }
}

/**
 * Broadcast headless progress update
 */
export function broadcastHeadlessProgress(status: string, phase?: string, isRefinement?: boolean): void {
    broadcast('headless_progress', { status, phase, isRefinement: isRefinement ?? false });
}

/**
 * Broadcast headless execution started
 */
export function broadcastHeadlessStarted(tool: string, phase?: string, isRefinement?: boolean): void {
    broadcast('headless_started', { tool, phase, isRefinement: isRefinement ?? false });
}

/**
 * Broadcast headless execution completed
 */
export function broadcastHeadlessCompleted(tool: string, success: boolean, phase?: string, sessionId?: string, isRefinement?: boolean): void {
    broadcast('headless_completed', { tool, success, phase, sessionId, isRefinement: isRefinement ?? false });
}

/**
 * Broadcast session ID captured (early - before execution completes)
 * This allows the frontend to enable RefinePanel immediately
 */
export function broadcastSessionCaptured(sessionId: string, phase?: string): void {
    broadcast('session_captured', { sessionId, phase });
}
