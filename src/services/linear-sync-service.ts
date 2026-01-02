/**
 * Linear Sync Service - Orchestrates syncing Specwright projects to Linear
 *
 * Handles the complete sync flow: project creation, document sync, issue sync
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { LinearService, createLinearService } from './linear-service.js';
import {
  mapProjectToLinear,
  mapIssueToLinear,
  createDocumentInput,
  generateExternalLinks,
  parseIssueDependencies,
} from './linear-mapper.js';
import { loadSettings, updateSettings, type LinearSettings } from './settings-service.js';
import { getProjectPath, getPRDPath, getDesignBriefPath, getTechnicalSpecPath } from '../utils/project-paths.js';
import type { ProjectMetadata, IssueMetadata } from '../types/index.js';
import type { LinearSyncState, SyncResult, LinearTeamInfo } from '../types/linear-sync.js';
import { OUTPUT_DIR } from '../config/constants.js';

/**
 * Path to sync state file for a project
 */
function getSyncStatePath(projectId: string): string {
  const projectPath = getProjectPath(projectId);
  return path.join(projectPath, 'linear_sync.json');
}

/**
 * Load sync state for a project
 */
export function loadSyncState(projectId: string): LinearSyncState | null {
  const syncPath = getSyncStatePath(projectId);
  if (fs.existsSync(syncPath)) {
    try {
      const content = fs.readFileSync(syncPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to load sync state:', error);
    }
  }
  return null;
}

/**
 * Save sync state for a project
 */
function saveSyncState(projectId: string, state: LinearSyncState): void {
  const syncPath = getSyncStatePath(projectId);
  // Ensure the directory exists
  const dir = path.dirname(syncPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(syncPath, JSON.stringify(state, null, 2));
}

/**
 * Check if Linear is configured
 */
export function isLinearConfigured(): boolean {
  const settings = loadSettings();
  return !!(settings.linear?.apiKey);
}

/**
 * Get Linear configuration
 */
export function getLinearConfig(): LinearSettings | undefined {
  const settings = loadSettings();
  return settings.linear;
}

/**
 * Save Linear configuration
 */
export function saveLinearConfig(config: LinearSettings): void {
  updateSettings({ linear: config });
}

/**
 * Validate Linear API key
 */
export async function validateLinearApiKey(apiKey: string): Promise<boolean> {
  const service = createLinearService(apiKey);
  return service.validateApiKey();
}

/**
 * Get available Linear teams
 */
export async function getLinearTeams(apiKey?: string): Promise<LinearTeamInfo[]> {
  const key = apiKey || getLinearConfig()?.apiKey;
  if (!key) {
    throw new Error('Linear API key not configured');
  }
  const service = createLinearService(key);
  return service.getTeams();
}

/**
 * Check if a project is synced to Linear (local check only)
 */
export function isProjectSynced(projectId: string): boolean {
  const syncState = loadSyncState(projectId);
  return syncState !== null && !!syncState.linearProjectId;
}

/**
 * Get sync state for a project
 */
export function getProjectSyncState(projectId: string): LinearSyncState | null {
  return loadSyncState(projectId);
}

/**
 * Clear sync state for a project (when Linear project is deleted)
 */
export function clearSyncState(projectId: string): void {
  const syncPath = getSyncStatePath(projectId);
  if (fs.existsSync(syncPath)) {
    fs.unlinkSync(syncPath);
    logger.debug(`Cleared sync state for project ${projectId}`);
  }
}

/**
 * Verify if the Linear project still exists and clear sync state if not
 * Returns true if synced and project exists, false otherwise
 */
export async function verifyLinearProjectExists(projectId: string): Promise<boolean> {
  const syncState = loadSyncState(projectId);
  if (!syncState || !syncState.linearProjectId) {
    return false;
  }

  const config = getLinearConfig();
  if (!config?.apiKey) {
    // Can't verify without API key, assume it exists
    return true;
  }

  const service = createLinearService(config.apiKey);
  const exists = await service.projectExists(syncState.linearProjectId);

  if (!exists) {
    // Project was deleted in Linear, clear local sync state
    clearSyncState(projectId);
    logger.debug(`Linear project for ${projectId} no longer exists, cleared sync state`);
  }

  return exists;
}

/**
 * Main sync function - syncs a Specwright project to Linear
 */
export async function syncProjectToLinear(
  projectId: string,
  project: ProjectMetadata,
  issues: IssueMetadata[],
  teamId?: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let issuesSynced = 0;
  let documentsSynced = 0;

  logger.debug(`\n📦 Starting Linear sync for project ${projectId}`);
  logger.debug(`  Project name: ${project.name}`);
  logger.debug(`  Project ID: ${project.id}`);
  logger.debug(`  Issues to sync: ${issues.length}`);

  // Get Linear config
  const config = getLinearConfig();
  if (!config?.apiKey) {
    return {
      success: false,
      issuesSynced: 0,
      documentsSynced: 0,
      errors: ['Linear API key not configured'],
    };
  }

  // Use provided team ID or default from settings
  const targetTeamId = teamId || config.defaultTeamId;
  if (!targetTeamId) {
    return {
      success: false,
      issuesSynced: 0,
      documentsSynced: 0,
      errors: ['No Linear team selected'],
    };
  }

  const service = createLinearService(config.apiKey);

  try {
    // Step 1: Create Linear project
    logger.debug(`Creating Linear project for ${project.name || project.id}...`);
    const projectInput = mapProjectToLinear(project, targetTeamId);
    const linearProject = await service.createProject(projectInput);

    // Step 2: Sync documents (PRD, Design Brief, Tech Spec)
    const documentIdMap: Record<string, string> = {};

    // Sync PRD
    const prdPath = getPRDPath(projectId);
    if (fs.existsSync(prdPath)) {
      try {
        const prdContent = fs.readFileSync(prdPath, 'utf-8');
        const prdInput = createDocumentInput('Product Requirements Document', prdContent, linearProject.id);
        const prdDoc = await service.createDocument(prdInput);
        documentIdMap['prd.md'] = prdDoc.id;
        documentsSynced++;
        logger.debug('PRD synced to Linear');
      } catch (error) {
        errors.push('Failed to sync PRD');
        logger.error('Failed to sync PRD:', error);
      }
    }

    // Sync Design Brief
    const designBriefPath = getDesignBriefPath(projectId);
    if (fs.existsSync(designBriefPath)) {
      try {
        const designContent = fs.readFileSync(designBriefPath, 'utf-8');
        const designInput = createDocumentInput('Design Brief', designContent, linearProject.id);
        const designDoc = await service.createDocument(designInput);
        documentIdMap['design_brief.md'] = designDoc.id;
        documentsSynced++;
        logger.debug('Design Brief synced to Linear');
      } catch (error) {
        errors.push('Failed to sync Design Brief');
        logger.error('Failed to sync Design Brief:', error);
      }
    }

    // Sync Technical Specification
    const techSpecPath = getTechnicalSpecPath(projectId);
    if (fs.existsSync(techSpecPath)) {
      try {
        const techContent = fs.readFileSync(techSpecPath, 'utf-8');
        const techInput = createDocumentInput('Technical Specification', techContent, linearProject.id);
        const techDoc = await service.createDocument(techInput);
        documentIdMap['technical_specification.md'] = techDoc.id;
        documentsSynced++;
        logger.debug('Technical Specification synced to Linear');
      } catch (error) {
        errors.push('Failed to sync Technical Specification');
        logger.error('Failed to sync Technical Specification:', error);
      }
    }

    // Step 3: Add external links as a "Resources" document
    // (Linear project descriptions are limited to 255 chars, so we use a document instead)
    try {
      const externalLinks = generateExternalLinks(projectId);
      const linksContent = [
        '# Specwright Resources',
        '',
        'Interactive resources that require the Specwright UI to render:',
        '',
        ...externalLinks.map(link => `- [${link.title}](${link.url})`),
        '',
        '> **Note:** These links require the Specwright server to be running locally.',
      ].join('\n');

      const linksDoc = await service.createDocument({
        title: 'Specwright Resources',
        content: linksContent,
        projectId: linearProject.id,
      });
      documentIdMap['resources.md'] = linksDoc.id;
      documentsSynced++;
      logger.debug('External links document added to Linear project');
    } catch (error) {
      errors.push('Failed to add external links document');
      logger.error('Failed to add external links document:', error);
    }

    // Step 4: Create issues
    const issueIdMap: Record<string, string> = {};
    const linearIssueIdMap = new Map<string, string>();

    for (const issue of issues) {
      try {
        const issueInput = mapIssueToLinear(issue, targetTeamId, linearProject.id);
        const linearIssue = await service.createIssue(issueInput);
        issueIdMap[issue.issueId] = linearIssue.id;
        linearIssueIdMap.set(issue.issueId, linearIssue.id);
        issuesSynced++;
        logger.debug(`Issue ${issue.issueId} synced to Linear as ${linearIssue.identifier}`);
      } catch (error) {
        errors.push(`Failed to sync issue ${issue.issueId}`);
        logger.error(`Failed to sync issue ${issue.issueId}:`, error);
      }
    }

    // Step 5: Set up issue dependencies
    try {
      const dependencies = parseIssueDependencies(issues);
      await service.setIssueDependencies(linearIssueIdMap, dependencies);
      logger.debug('Issue dependencies set up in Linear');
    } catch (error) {
      errors.push('Failed to set up some issue dependencies');
      logger.error('Failed to set up issue dependencies:', error);
    }

    // Step 6: Save sync state
    const teams = await service.getTeams();
    const team = teams.find(t => t.id === targetTeamId);

    const syncState: LinearSyncState = {
      syncedAt: new Date().toISOString(),
      linearProjectId: linearProject.id,
      linearProjectUrl: linearProject.url,
      linearTeamId: targetTeamId,
      linearTeamName: team?.name || 'Unknown',
      issueIdMap,
      documentIdMap,
      externalLinks: generateExternalLinks(projectId).map(link => ({
        resource: link.title,
        url: link.url,
      })),
    };

    saveSyncState(projectId, syncState);
    logger.debug('Sync state saved');

    return {
      success: errors.length === 0,
      linearProjectId: linearProject.id,
      linearProjectUrl: linearProject.url,
      issuesSynced,
      documentsSynced,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logger.error('Sync failed:', error);
    return {
      success: false,
      issuesSynced,
      documentsSynced,
      errors: [`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Get all synced projects
 */
export function getSyncedProjects(): Array<{ projectId: string; syncState: LinearSyncState }> {
  const projectsDir = path.join(OUTPUT_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const results: Array<{ projectId: string; syncState: LinearSyncState }> = [];

  const projectFolders = fs.readdirSync(projectsDir);
  for (const folder of projectFolders) {
    const syncPath = path.join(projectsDir, folder, 'linear_sync.json');
    if (fs.existsSync(syncPath)) {
      try {
        const content = fs.readFileSync(syncPath, 'utf-8');
        const syncState = JSON.parse(content) as LinearSyncState;
        // Extract project ID from folder name (e.g., "001-project-name" -> "001")
        const projectId = folder.split('-')[0];
        results.push({ projectId, syncState });
      } catch (error) {
        logger.error(`Failed to read sync state for ${folder}:`, error);
      }
    }
  }

  return results;
}
