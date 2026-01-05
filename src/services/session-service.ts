/**
 * Session Management Service
 *
 * Manages Claude CLI session IDs for each agent/phase.
 * Sessions are persisted to disk so they survive page reloads.
 *
 * Session Lifecycle:
 * - Scoping: One session for the entire scoping process
 * - PM Agent: One session shared between questions and PRD generation
 * - Designer Agent: One session shared between questions and all design documents
 * - Engineer Agent: One session shared between questions and tech spec generation
 * - Breakdown: One session for issue generation
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export type AgentType = 'scoping' | 'pm' | 'ux' | 'engineer' | 'breakdown';

interface SessionStore {
  scoping?: string;      // Scoping agent session
  pm?: string;           // Product Manager agent session (questions + PRD)
  ux?: string;           // UX Designer agent session (questions + design docs)
  engineer?: string;     // Engineer agent session (questions + tech spec)
  breakdown?: string;    // Breakdown agent session (issue generation)
}

/**
 * Get the path to the sessions.json file for a project
 */
function getSessionsFilePath(projectId: string): string {
  const OUTPUT_DIR = path.join(process.cwd(), '.specwright');
  return path.join(OUTPUT_DIR, 'projects', projectId, 'sessions.json');
}

/**
 * Load session store from disk
 */
function loadSessionStore(projectId: string): SessionStore {
  const filePath = getSessionsFilePath(projectId);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    logger.error('Error loading sessions.json:', error);
  }

  return {};
}

/**
 * Save session store to disk
 */
function saveSessionStore(projectId: string, store: SessionStore): void {
  const filePath = getSessionsFilePath(projectId);
  const dir = path.dirname(filePath);

  try {
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write sessions file
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
    logger.debug(`✅ Saved session for project ${projectId}`);
  } catch (error) {
    logger.error('Error saving sessions.json:', error);
    throw error;
  }
}

/**
 * Get session ID for a specific agent
 * Returns undefined if no session exists for that agent
 */
export function getAgentSession(projectId: string, agent: AgentType): string | undefined {
  const store = loadSessionStore(projectId);
  const sessionId = store[agent];

  if (sessionId) {
    logger.debug(`📌 Retrieved session for ${agent}: ${sessionId}`);
  } else {
    logger.debug(`📭 No existing session for ${agent}`);
  }

  return sessionId;
}

/**
 * Save/update session ID for a specific agent
 */
export function saveAgentSession(projectId: string, agent: AgentType, sessionId: string): void {
  logger.debug(`💾 Saving session for ${agent}: ${sessionId}`);

  const store = loadSessionStore(projectId);
  store[agent] = sessionId;
  saveSessionStore(projectId, store);
}

/**
 * Get all sessions for a project (for frontend API)
 */
export function getAllSessions(projectId: string): SessionStore {
  return loadSessionStore(projectId);
}

/**
 * Clear session for a specific agent
 * (useful when starting fresh for that agent)
 */
export function clearAgentSession(projectId: string, agent: AgentType): void {
  logger.debug(`🗑️ Clearing session for ${agent}`);

  const store = loadSessionStore(projectId);
  delete store[agent];
  saveSessionStore(projectId, store);
}

/**
 * Clear all sessions for a project
 */
export function clearAllSessions(projectId: string): void {
  logger.debug(`🗑️ Clearing all sessions for project ${projectId}`);

  const filePath = getSessionsFilePath(projectId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * For scoping (which doesn't have a projectId yet), we use a special "scoping" project ID
 */
export const SCOPING_PROJECT_ID = '_scoping_active';

/**
 * Convenience functions for scoping
 */
export function getScopingSession(): string | undefined {
  return getAgentSession(SCOPING_PROJECT_ID, 'scoping');
}

export function saveScopingSession(sessionId: string): void {
  saveAgentSession(SCOPING_PROJECT_ID, 'scoping', sessionId);
}

export function clearScopingSession(): void {
  clearAgentSession(SCOPING_PROJECT_ID, 'scoping');
}
