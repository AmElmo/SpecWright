/**
 * Status Service - Manages project status tracking
 * 
 * Provides functions to read, write, and update project status files
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import type { 
  ProjectStatus, 
  AgentType, 
  PhaseStatus,
  PhaseHistoryEntry 
} from '../types/project-status.js';
import type { ProjectSettings, ProjectIcon } from '../types/index.js';
import { createInitialStatus, HUMAN_REQUIRED_PHASES } from '../types/project-status.js';
import { validateCurrentPhase } from './phase-validation-service.js';
import { logger } from '../utils/logger.js';

const STATUS_FILENAME = 'project_status.json';

/**
 * Get the status file path for a project
 */
function getStatusFilePath(projectId: string): string {
  return path.join(OUTPUT_DIR, 'projects', projectId, STATUS_FILENAME);
}

/**
 * Read project status from file
 * Returns null if file doesn't exist or is invalid
 */
export function readProjectStatus(projectId: string): ProjectStatus | null {
  const statusPath = getStatusFilePath(projectId);
  
  if (!fs.existsSync(statusPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(statusPath, 'utf-8');
    const status = JSON.parse(content) as ProjectStatus;
    return status;
  } catch (error) {
    logger.error(`Error reading status file for ${projectId}:`, error);
    return null;
  }
}

/**
 * Write project status to file with atomic write and error handling
 * 
 * BEST PRACTICES IMPLEMENTED:
 * - Atomic writes using temp file + rename (prevents partial writes)
 * - Comprehensive error handling with retries
 * - No side effects (timestamp must be set by caller)
 * - Proper logging
 * 
 * @param projectId - Project identifier
 * @param status - Project status to write (must have lastUpdatedAt already set)
 * @throws Error if write fails after retries
 */
export function writeProjectStatus(projectId: string, status: ProjectStatus): void {
  const statusPath = getStatusFilePath(projectId);
  const tempPath = `${statusPath}.tmp`;
  
  // Ensure timestamp is set by caller (best practice: no side effects)
  if (!status.lastUpdatedAt) {
    logger.warn(`⚠️  [Status Service] lastUpdatedAt not set for ${projectId}, setting now`);
    status.lastUpdatedAt = new Date().toISOString();
  }
  
  try {
    // Ensure directory exists
    const dir = path.dirname(statusPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Serialize JSON
    const jsonContent = JSON.stringify(status, null, 2);
    
    // ATOMIC WRITE: Write to temp file first
    try {
      fs.writeFileSync(tempPath, jsonContent, 'utf-8');
    } catch (writeError) {
      throw new Error(`Failed to write temp file: ${writeError}`);
    }
    
    // ATOMIC RENAME: Move temp file to actual location (atomic operation on most filesystems)
    try {
      fs.renameSync(tempPath, statusPath);
    } catch (renameError) {
      // Cleanup temp file if rename fails
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to rename temp file: ${renameError}`);
    }
    
    logger.debug(`✅ [Status Service] Successfully wrote status for ${projectId}`);
    
  } catch (error) {
    logger.error(`❌ [Status Service] Failed to write status for ${projectId}:`, error);
    
    // Cleanup temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    // Re-throw so callers know write failed
    throw new Error(`Failed to write project status for ${projectId}: ${error}`);
  }
}

/**
 * Initialize status for a new project
 */
export function initializeProjectStatus(projectId: string, settings?: ProjectSettings): ProjectStatus {
  const status = createInitialStatus(projectId, settings);
  status.lastUpdatedAt = new Date().toISOString();
  writeProjectStatus(projectId, status);
  return status;
}

/**
 * Get or create project status
 */
export function getOrCreateStatus(projectId: string): ProjectStatus {
  let status = readProjectStatus(projectId);
  
  if (!status) {
    status = initializeProjectStatus(projectId);
  }
  
  return status;
}

/**
 * Update phase status for a specific agent
 */
export function updatePhaseStatus(
  projectId: string,
  agent: AgentType,
  phase: string,
  newStatus: PhaseStatus
): ProjectStatus {
  const status = getOrCreateStatus(projectId);
  
  const agentStatus = status.agents[agent];
  
  // Update the specific phase
  if (!agentStatus.phases[phase]) {
    agentStatus.phases[phase] = { status: 'not-started' };
  }
  
  const phaseData = agentStatus.phases[phase];
  const oldStatus = phaseData.status;
  phaseData.status = newStatus;
  
  // Track timestamps
  if (newStatus !== 'not-started' && !phaseData.startedAt) {
    phaseData.startedAt = new Date().toISOString();
  }
  
  if (newStatus === 'complete' && !phaseData.completedAt) {
    phaseData.completedAt = new Date().toISOString();
  }
  
  // Add to history if status changed
  if (oldStatus !== newStatus) {
    status.history.push({
      phase: `${agent}-${phase}`,
      startedAt: phaseData.startedAt || new Date().toISOString(),
      completedAt: phaseData.completedAt,
      status: newStatus
    });
  }
  
  // Update agent status
  agentStatus.currentPhase = phase;
  
  // Check if all phases for this agent are complete
  const allPhasesComplete = Object.values(agentStatus.phases).every(
    p => p.status === 'complete'
  );
  
  if (allPhasesComplete) {
    agentStatus.status = 'complete';
    agentStatus.completedAt = new Date().toISOString();
  }
  
  // Set timestamp before writing
  status.lastUpdatedAt = new Date().toISOString();
  writeProjectStatus(projectId, status);
  return status;
}

/**
 * Advance to next phase after current phase completes
 * Respects the natural flow: PM → UX → Engineer
 */
export function advanceToNextPhase(projectId: string): ProjectStatus {
  const status = getOrCreateStatus(projectId);
  
  const currentAgent = status.currentAgent;
  
  if (currentAgent === 'complete') {
    return status;
  }
  
  const agentStatus = status.agents[currentAgent];
  const currentPhase = agentStatus.currentPhase;
  
  if (!currentPhase) {
    return status;
  }
  
  // Get phase list for current agent
  const phaseList = getPhaseList(currentAgent);
  const currentIndex = phaseList.indexOf(currentPhase);
  
  if (currentIndex === -1) {
    logger.error(`Unknown phase: ${currentPhase} for agent ${currentAgent}`);
    return status;
  }
  
  // Check if current phase is complete
  if (agentStatus.phases[currentPhase]?.status !== 'complete') {
    return status;
  }
  
  // Move to next phase in same agent
  if (currentIndex < phaseList.length - 1) {
    const nextPhase = phaseList[currentIndex + 1];
    status.currentPhase = `${currentAgent}-${nextPhase}`;
    agentStatus.currentPhase = nextPhase;
    
    // Set appropriate status for the new phase
    if (!agentStatus.phases[nextPhase]) {
      agentStatus.phases[nextPhase] = { status: 'not-started' };
    }
    
    // If next phase is a review or answer phase, set status to awaiting-user or user-reviewing
    if (HUMAN_REQUIRED_PHASES.includes(nextPhase)) {
      if (nextPhase === 'questions-answer') {
        agentStatus.phases[nextPhase].status = 'awaiting-user';
      } else if (nextPhase.endsWith('-review')) {
        agentStatus.phases[nextPhase].status = 'user-reviewing';
      }
    }
  } else {
    // Agent complete, move to next agent
    if (currentAgent === 'pm') {
      status.currentAgent = 'ux';
      status.currentPhase = 'ux-questions-generate';
      status.agents.ux.currentPhase = 'questions-generate';
    } else if (currentAgent === 'ux') {
      status.currentAgent = 'engineer';
      status.currentPhase = 'engineer-questions-generate';
      status.agents.engineer.currentPhase = 'questions-generate';
    } else if (currentAgent === 'engineer') {
      status.currentAgent = 'complete';
      status.currentPhase = 'complete';
    }
  }
  
  // Set timestamp before writing
  status.lastUpdatedAt = new Date().toISOString();
  writeProjectStatus(projectId, status);
  return status;
}

/**
 * Mark a phase as complete and advance to next phase
 * 
 * OPTIMIZED: Batches all updates in memory and writes ONCE at the end
 * This prevents the double-write that occurred when calling updatePhaseStatus + advanceToNextPhase separately
 */
export function completePhaseAndAdvance(
  projectId: string,
  agent: AgentType,
  phase: string
): ProjectStatus {
  logger.debug(`\n🔄 [Status Service] completePhaseAndAdvance: ${agent}-${phase}`);
  
  // Read current status
  const status = getOrCreateStatus(projectId);
  
  // === STEP 1: Update phase status (in memory only) ===
  const agentStatus = status.agents[agent];
  
  // Update the specific phase
  if (!agentStatus.phases[phase]) {
    agentStatus.phases[phase] = { status: 'not-started' };
  }
  
  const phaseData = agentStatus.phases[phase];
  const oldStatus = phaseData.status;
  phaseData.status = 'complete';
  
  // Track timestamps
  if (!phaseData.startedAt) {
    phaseData.startedAt = new Date().toISOString();
  }
  
  if (!phaseData.completedAt) {
    phaseData.completedAt = new Date().toISOString();
  }
  
  // Add to history if status changed
  if (oldStatus !== 'complete') {
    status.history.push({
      phase: `${agent}-${phase}`,
      startedAt: phaseData.startedAt,
      completedAt: phaseData.completedAt,
      status: 'complete'
    });
  }
  
  // Update agent current phase
  agentStatus.currentPhase = phase;
  
  // Check if all phases for this agent are complete
  const allPhasesComplete = Object.values(agentStatus.phases).every(
    p => p.status === 'complete'
  );
  
  if (allPhasesComplete) {
    agentStatus.status = 'complete';
    agentStatus.completedAt = new Date().toISOString();
  }
  
  logger.debug(`✅ [Status Service] Phase marked complete: ${agent}-${phase}`);
  
  // === STEP 2: Advance to next phase (in memory only) ===
  const currentAgent = status.currentAgent;
  
  if (currentAgent !== 'complete') {
    const currentAgentStatus = status.agents[currentAgent];
    const currentPhase = currentAgentStatus.currentPhase;
    
    if (currentPhase) {
      // Get phase list for current agent
      const phaseList = getPhaseList(currentAgent);
      const currentIndex = phaseList.indexOf(currentPhase);
      
      if (currentIndex >= 0 && currentAgentStatus.phases[currentPhase]?.status === 'complete') {
        // Move to next phase in same agent
        if (currentIndex < phaseList.length - 1) {
          const nextPhase = phaseList[currentIndex + 1];
          status.currentPhase = `${currentAgent}-${nextPhase}`;
          currentAgentStatus.currentPhase = nextPhase;
          
          // Set appropriate status for the new phase
          if (!currentAgentStatus.phases[nextPhase]) {
            currentAgentStatus.phases[nextPhase] = { status: 'not-started' };
          }
          
          // If next phase is a review or answer phase, set status to awaiting-user or user-reviewing
          if (HUMAN_REQUIRED_PHASES.includes(nextPhase)) {
            if (nextPhase === 'questions-answer') {
              currentAgentStatus.phases[nextPhase].status = 'awaiting-user';
            } else if (nextPhase.endsWith('-review')) {
              currentAgentStatus.phases[nextPhase].status = 'user-reviewing';
            }
          }
          
          logger.debug(`➡️  [Status Service] Advanced to next phase: ${status.currentPhase}`);
        } else {
          // Agent complete, move to next agent
          if (currentAgent === 'pm') {
            status.currentAgent = 'ux';
            status.currentPhase = 'ux-questions-generate';
            status.agents.ux.currentPhase = 'questions-generate';
            logger.debug(`➡️  [Status Service] PM complete, moving to UX`);
          } else if (currentAgent === 'ux') {
            status.currentAgent = 'engineer';
            status.currentPhase = 'engineer-questions-generate';
            status.agents.engineer.currentPhase = 'questions-generate';
            logger.debug(`➡️  [Status Service] UX complete, moving to Engineer`);
          } else if (currentAgent === 'engineer') {
            status.currentAgent = 'complete';
            status.currentPhase = 'complete';
            logger.debug(`➡️  [Status Service] Engineer complete, project finished!`);
          }
        }
      }
    }
  }
  
  // === STEP 3: Write ONCE with all updates ===
  status.lastUpdatedAt = new Date().toISOString();
  writeProjectStatus(projectId, status);
  
  logger.debug(`💾 [Status Service] Single write completed for ${projectId}`);
  
  return status;
}

/**
 * Get the list of phases for an agent
 */
function getPhaseList(agent: AgentType): string[] {
  const PHASE_LISTS = {
    pm: ['questions-generate', 'questions-answer', 'prd-generate', 'prd-review'],
    ux: ['questions-generate', 'questions-answer', 'design-brief-generate', 'design-brief-review'],
    engineer: ['questions-generate', 'questions-answer', 'spec-generate', 'spec-review']
  };
  
  return PHASE_LISTS[agent];
}

/**
 * Check if current phase requires human input
 */
export function isHumanInputRequired(status: ProjectStatus): boolean {
  const fullPhase = status.currentPhase;
  
  return HUMAN_REQUIRED_PHASES.some(humanPhase => 
    fullPhase.endsWith(humanPhase)
  );
}

/**
 * Mark AI work as started for current phase
 */
export function markAIWorkStarted(projectId: string): ProjectStatus {
  logger.debug(`\n🚀 [Status Service] markAIWorkStarted called for ${projectId}`);
  
  const status = getOrCreateStatus(projectId);
  
  if (status.currentAgent === 'complete') {
    logger.debug(`⚠️  [Status Service] Project already complete, not starting work`);
    return status;
  }
  
  const agent = status.currentAgent;
  const phase = status.agents[agent].currentPhase;
  
  logger.debug(`👤 [Status Service] Agent: ${agent}`);
  logger.debug(`📍 [Status Service] Phase: ${phase}`);
  
  if (!phase) {
    logger.debug(`⚠️  [Status Service] No current phase, skipping`);
    return status;
  }
  
  logger.debug(`✅ [Status Service] Updating phase status to 'ai-working'`);
  return updatePhaseStatus(projectId, agent, phase, 'ai-working');
}

/**
 * Mark AI work as complete (file generated, awaiting user review)
 */
export function markAIWorkComplete(projectId: string): ProjectStatus {
  logger.debug(`\n✨ [Status Service] markAIWorkComplete called for ${projectId}`);
  
  const status = getOrCreateStatus(projectId);
  
  if (status.currentAgent === 'complete') {
    logger.debug(`⚠️  [Status Service] Project already complete`);
    return status;
  }
  
  const agent = status.currentAgent;
  const phase = status.agents[agent].currentPhase;
  
  logger.debug(`👤 [Status Service] Agent: ${agent}`);
  logger.debug(`📍 [Status Service] Current phase: ${phase}`);
  logger.debug(`📊 [Status Service] Full phase name: ${status.currentPhase}`);
  
  if (!phase) {
    logger.debug(`⚠️  [Status Service] No current phase, skipping`);
    return status;
  }
  
  // AI work is complete - mark phase as complete and advance to next phase!
  // This handles: questions-generate → questions-answer (awaiting user)
  //               prd-generate → prd-review (user reviewing)
  //               inventory-generate → inventory-review (user reviewing)
  //               wireframes-generate → wireframes-review (user reviewing)
  //               spec-generate → spec-review (user reviewing)
  logger.debug(`✅ [Status Service] Marking phase complete and advancing to next phase...`);
  
  const updatedStatus = completePhaseAndAdvance(projectId, agent, phase);
  
  logger.debug(`✅ [Status Service] Phase advanced! New phase: ${updatedStatus.currentPhase}`);
  
  return updatedStatus;
}

/**
 * Validate and auto-recover from invalid phase states
 * If current phase requires files that don't exist, revert to the generate phase
 */
export function validateAndRecoverPhase(projectId: string): ProjectStatus {
  logger.debug(`\n🔍 [Status Service] Validating phase state for ${projectId}`);
  
  const status = getOrCreateStatus(projectId);
  
  // Skip validation if project is complete
  if (status.currentAgent === 'complete') {
    return status;
  }
  
  // Validate the current phase
  const validation = validateCurrentPhase(projectId, status.currentPhase);
  
  // IMPORTANT: Don't auto-recover review phases - they may have been advanced by retroactive check
  // Check if any agent has a phase in 'user-reviewing' status
  const hasUserReviewing = Object.values(status.agents).some(agent => 
    agent.currentPhase && agent.phases[agent.currentPhase]?.status === 'user-reviewing'
  );
  
  if (hasUserReviewing && !validation.isValid) {
    logger.debug(`ℹ️  [Status Service] Skipping validation recovery - phase is user-reviewing`);
    return status;
  }
  
  if (!validation.isValid && validation.suggestedPhase) {
    logger.debug(`\n⚠️  [Status Service] Invalid phase state detected!`);
    logger.debug(`   Current phase: ${status.currentPhase}`);
    logger.debug(`   Reason: ${validation.reason}`);
    logger.debug(`   Reverting to: ${validation.suggestedPhase}`);
    
    // Parse the suggested phase to get agent and phase name
    const [agent, ...phaseParts] = validation.suggestedPhase.split('-');
    const phaseName = phaseParts.join('-');
    
    // Update status to the suggested phase
    status.currentPhase = validation.suggestedPhase;
    status.currentAgent = agent as AgentType;
    status.agents[agent as AgentType].currentPhase = phaseName;
    
    // Set the phase status to not-started so user can trigger it again
    if (!status.agents[agent as AgentType].phases[phaseName]) {
      status.agents[agent as AgentType].phases[phaseName] = { status: 'not-started' };
    } else {
      status.agents[agent as AgentType].phases[phaseName].status = 'not-started';
    }
    
    // Set timestamp before writing
    status.lastUpdatedAt = new Date().toISOString();
    
    // Write the recovered status
    writeProjectStatus(projectId, status);
    
    logger.debug(`✅ [Status Service] Phase state recovered to ${validation.suggestedPhase}`);
  } else {
    logger.debug(`✅ [Status Service] Phase state is valid`);
  }
  
  return status;
}

/**
 * Update project settings in the status file
 */
export function updateProjectSettings(projectId: string, settings: ProjectSettings): ProjectStatus {
  const status = getOrCreateStatus(projectId);
  
  // Update settings
  status.settings = settings;
  
  // Set timestamp before writing
  status.lastUpdatedAt = new Date().toISOString();
  
  writeProjectStatus(projectId, status);
  
  logger.debug(`✅ [Status Service] Settings updated for ${projectId}`);
  return status;
}

/**
 * Get project settings from status file
 */
export function getProjectSettings(projectId: string): ProjectSettings | undefined {
  const status = readProjectStatus(projectId);
  return status?.settings;
}

/**
 * Update project icon in the status file
 */
export function updateProjectIcon(projectId: string, icon: ProjectIcon | null): ProjectStatus {
  const status = getOrCreateStatus(projectId);
  
  // Update or remove icon
  if (icon === null) {
    delete status.icon;
  } else {
    status.icon = icon;
  }
  
  // Set timestamp before writing
  status.lastUpdatedAt = new Date().toISOString();
  
  writeProjectStatus(projectId, status);
  
  logger.debug(`✅ [Status Service] Icon updated for ${projectId}`);
  return status;
}

/**
 * Get project icon from status file
 */
export function getProjectIcon(projectId: string): ProjectIcon | undefined {
  const status = readProjectStatus(projectId);
  return status?.icon;
}

