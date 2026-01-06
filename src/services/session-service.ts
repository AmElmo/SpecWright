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
 *
 * Sessions are automatically cleaned up after 7 days of inactivity.
 * Associated refinement images are deleted when sessions are cleared.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export type AgentType = 'scoping' | 'pm' | 'ux' | 'engineer' | 'breakdown';

/**
 * Session entry with timestamp for TTL-based cleanup
 */
interface SessionEntry {
  sessionId: string;
  createdAt: string;  // ISO timestamp
  updatedAt: string;  // ISO timestamp - updated on each use
}

interface SessionStore {
  scoping?: SessionEntry;
  pm?: SessionEntry;
  ux?: SessionEntry;
  engineer?: SessionEntry;
  breakdown?: SessionEntry;
}

/**
 * TTL for session cleanup - 7 days in milliseconds
 */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get the path to the sessions.json file for a project
 */
function getSessionsFilePath(projectId: string): string {
  const OUTPUT_DIR = path.join(process.cwd(), '.specwright');
  return path.join(OUTPUT_DIR, 'projects', projectId, 'sessions.json');
}

/**
 * Get the path to the refinement images directory for a project/agent
 */
function getImagesDir(projectId: string, agent?: AgentType): string {
  const OUTPUT_DIR = path.join(process.cwd(), '.specwright');
  const baseDir = path.join(OUTPUT_DIR, 'projects', projectId, 'refinement-images');
  return agent ? path.join(baseDir, agent) : baseDir;
}

/**
 * Check if a session entry is expired (older than TTL)
 */
function isSessionExpired(entry: SessionEntry): boolean {
  const updatedAt = new Date(entry.updatedAt).getTime();
  const elapsed = Date.now() - updatedAt;
  return elapsed > SESSION_TTL_MS;
}

/**
 * Clean up expired sessions and their associated images
 */
function cleanupExpiredSessions(projectId: string, store: SessionStore): SessionStore {
  const cleanedStore: SessionStore = {};
  let hasExpired = false;

  for (const [agent, entry] of Object.entries(store)) {
    if (entry && !isSessionExpired(entry)) {
      cleanedStore[agent as AgentType] = entry;
    } else if (entry) {
      hasExpired = true;
      logger.debug(`🧹 Cleaning up expired session for ${agent} (last updated: ${entry.updatedAt})`);
      // Clean up associated images
      deleteAgentImages(projectId, agent as AgentType);
    }
  }

  return cleanedStore;
}

/**
 * Delete images for a specific agent
 */
function deleteAgentImages(projectId: string, agent: AgentType): void {
  const imagesDir = getImagesDir(projectId, agent);
  try {
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);
      for (const file of files) {
        fs.unlinkSync(path.join(imagesDir, file));
      }
      fs.rmdirSync(imagesDir);
      logger.debug(`🗑️ Deleted refinement images for ${agent}`);
    }
  } catch (error) {
    logger.debug(`Failed to delete images for ${agent}:`, error);
  }
}

/**
 * Load session store from disk, cleaning up expired entries
 */
function loadSessionStore(projectId: string): SessionStore {
  const filePath = getSessionsFilePath(projectId);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const store = JSON.parse(content) as SessionStore;

      // Clean up expired sessions
      const cleanedStore = cleanupExpiredSessions(projectId, store);

      // Save back if we cleaned anything
      if (Object.keys(cleanedStore).length !== Object.keys(store).length) {
        saveSessionStore(projectId, cleanedStore);
      }

      return cleanedStore;
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
  const entry = store[agent];

  if (entry) {
    logger.debug(`📌 Retrieved session for ${agent}: ${entry.sessionId}`);
    return entry.sessionId;
  } else {
    logger.debug(`📭 No existing session for ${agent}`);
    return undefined;
  }
}

/**
 * Save/update session ID for a specific agent
 */
export function saveAgentSession(projectId: string, agent: AgentType, sessionId: string): void {
  logger.debug(`💾 Saving session for ${agent}: ${sessionId}`);

  const store = loadSessionStore(projectId);
  const now = new Date().toISOString();

  const existingEntry = store[agent];
  store[agent] = {
    sessionId,
    createdAt: existingEntry?.createdAt || now,
    updatedAt: now
  };

  saveSessionStore(projectId, store);
}

/**
 * Get all sessions for a project (for frontend API)
 * Returns just the session IDs for API compatibility
 */
export function getAllSessions(projectId: string): Record<string, string> {
  const store = loadSessionStore(projectId);
  const result: Record<string, string> = {};

  for (const [agent, entry] of Object.entries(store)) {
    if (entry) {
      result[agent] = entry.sessionId;
    }
  }

  return result;
}

/**
 * Clear session for a specific agent
 * Also deletes any associated refinement images
 */
export function clearAgentSession(projectId: string, agent: AgentType): void {
  logger.debug(`🗑️ Clearing session for ${agent}`);

  // Delete associated images first
  deleteAgentImages(projectId, agent);

  const store = loadSessionStore(projectId);
  delete store[agent];
  saveSessionStore(projectId, store);
}

/**
 * Clear all sessions for a project
 * Also deletes all refinement images
 */
export function clearAllSessions(projectId: string): void {
  logger.debug(`🗑️ Clearing all sessions for project ${projectId}`);

  // Delete all images
  const imagesBaseDir = getImagesDir(projectId);
  try {
    if (fs.existsSync(imagesBaseDir)) {
      // Delete all agent subdirectories
      const agents = fs.readdirSync(imagesBaseDir);
      for (const agent of agents) {
        const agentDir = path.join(imagesBaseDir, agent);
        if (fs.statSync(agentDir).isDirectory()) {
          const files = fs.readdirSync(agentDir);
          for (const file of files) {
            fs.unlinkSync(path.join(agentDir, file));
          }
          fs.rmdirSync(agentDir);
        }
      }
      fs.rmdirSync(imagesBaseDir);
    }
  } catch (error) {
    logger.debug('Failed to delete all images:', error);
  }

  const filePath = getSessionsFilePath(projectId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Save refinement images for an agent
 * Returns array of file paths that can be referenced in prompts
 */
export function saveRefinementImages(
  projectId: string,
  agent: AgentType,
  images: { filename: string; data: Buffer }[]
): string[] {
  const imagesDir = getImagesDir(projectId, agent);

  // Ensure directory exists
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const savedPaths: string[] = [];

  for (const image of images) {
    const filePath = path.join(imagesDir, image.filename);
    fs.writeFileSync(filePath, image.data);
    savedPaths.push(filePath);
    logger.debug(`📸 Saved refinement image: ${filePath}`);
  }

  return savedPaths;
}

/**
 * Get all refinement image paths for an agent
 */
export function getRefinementImages(projectId: string, agent: AgentType): string[] {
  const imagesDir = getImagesDir(projectId, agent);

  if (!fs.existsSync(imagesDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(imagesDir);
    return files.map(file => path.join(imagesDir, file));
  } catch {
    return [];
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
