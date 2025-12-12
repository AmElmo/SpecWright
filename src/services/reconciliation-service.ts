/**
 * Reconciliation Service - Validates and repairs project status
 * 
 * PURPOSE:
 * Ensures project_status.json stays in sync with actual file reality.
 * Detects and repairs drift when stored status doesn't match what files exist.
 * 
 * ARCHITECTURE (Hybrid with Reconciliation):
 * - project_status.json is the primary source (stores intent, history, timestamps)
 * - Files are the ground truth (if a file is missing, status must reflect that)
 * - This service reconciles the two on project load
 * 
 * MAINTAINABILITY:
 * - All rules are defined in RECONCILIATION_RULES constant
 * - Adding a new phase/file check = add one entry to the rules
 * - Each rule is self-documenting with clear conditions
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import type { ProjectStatus, AgentType } from '../types/project-status.js';
import { readProjectStatus, writeProjectStatus } from './status-service.js';
import { 
  getPRDPath, 
  getDesignBriefPath, 
  getTechnicalSpecPath,
  getAcceptanceCriteriaPath,
  getScreensPath,
  getProjectSummaryPath
} from '../utils/project-paths.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

interface ReconciliationRule {
  /** Unique identifier for the rule (for logging) */
  id: string;
  
  /** Human-readable description of what this rule checks */
  description: string;
  
  /** Agent this rule applies to */
  agent: AgentType;
  
  /** Phase this rule validates */
  phase: string;
  
  /** 
   * Function that checks if the required files exist for this phase to be "complete"
   * Returns true if files support the phase being complete
   */
  filesExist: (projectId: string) => boolean;
  
  /**
   * Minimum file size in bytes (optional, for content validation)
   * Default: 100 bytes
   */
  minFileSize?: number;
}

interface ReconciliationResult {
  /** Whether any drift was detected and fixed */
  hadDrift: boolean;
  
  /** List of rules that detected drift */
  driftDetails: Array<{
    ruleId: string;
    description: string;
    storedStatus: string;
    fixedTo: string;
  }>;
  
  /** The reconciled status (may or may not have been modified) */
  status: ProjectStatus;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a file exists and has minimum content
 */
function fileExistsWithMinSize(filePath: string, minSize: number = 100): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const stats = fs.statSync(filePath);
    return stats.size >= minSize;
  } catch {
    return false;
  }
}

/**
 * Check if a JSON file exists and has valid content
 */
function jsonFileHasContent(filePath: string, requiredField?: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (requiredField) {
      return data[requiredField] !== undefined && data[requiredField] !== null;
    }
    
    return Object.keys(data).length > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// RECONCILIATION RULES
// ============================================================================

/**
 * Rules for validating phase completion against file reality.
 * 
 * HOW TO ADD A NEW RULE:
 * 1. Add an entry to this array
 * 2. Set the agent, phase, and description
 * 3. Implement filesExist() to check required files
 * 
 * The reconciliation service will automatically:
 * - Check this rule when loading the project
 * - Downgrade status if files don't support completion
 */
const RECONCILIATION_RULES: ReconciliationRule[] = [
  // -------------------------------------------------------------------------
  // PM Agent Rules
  // -------------------------------------------------------------------------
  {
    id: 'pm-prd-complete',
    description: 'PRD file must exist for PM PRD phase to be complete',
    agent: 'pm',
    phase: 'prd-generate',
    minFileSize: 500,
    filesExist: (projectId) => {
      const prdPath = getPRDPath(projectId);
      return fileExistsWithMinSize(prdPath, 500);
    }
  },
  {
    id: 'pm-acceptance-criteria',
    description: 'Acceptance criteria must exist for PM phase to be complete',
    agent: 'pm',
    phase: 'prd-generate',
    filesExist: (projectId) => {
      const acPath = getAcceptanceCriteriaPath(projectId);
      return jsonFileHasContent(acPath, 'acceptance_criteria');
    }
  },
  
  // -------------------------------------------------------------------------
  // UX Agent Rules
  // -------------------------------------------------------------------------
  {
    id: 'ux-design-brief-complete',
    description: 'Design brief must exist for UX phase to be complete',
    agent: 'ux',
    phase: 'design-brief-generate',
    minFileSize: 300,
    filesExist: (projectId) => {
      const designBriefPath = getDesignBriefPath(projectId);
      return fileExistsWithMinSize(designBriefPath, 300);
    }
  },
  {
    id: 'ux-screens-complete',
    description: 'Screens file must exist for UX phase to be complete',
    agent: 'ux',
    phase: 'design-brief-generate',
    filesExist: (projectId) => {
      const screensPath = getScreensPath(projectId);
      return jsonFileHasContent(screensPath, 'screens');
    }
  },
  
  // -------------------------------------------------------------------------
  // Engineer Agent Rules
  // -------------------------------------------------------------------------
  {
    id: 'engineer-spec-complete',
    description: 'Technical spec must exist for Engineer phase to be complete',
    agent: 'engineer',
    phase: 'spec-generate',
    minFileSize: 500,
    filesExist: (projectId) => {
      const specPath = getTechnicalSpecPath(projectId);
      return fileExistsWithMinSize(specPath, 500);
    }
  },
  
  // -------------------------------------------------------------------------
  // Issue Breakdown Rules
  // -------------------------------------------------------------------------
  {
    id: 'issues-breakdown-complete',
    description: 'Issues file must exist for project to be ready to ship',
    agent: 'engineer', // Issues are created after engineer phase
    phase: 'spec-review', // After spec review, issues should exist
    filesExist: (projectId) => {
      const issuesPath = getProjectSummaryPath(projectId);
      return jsonFileHasContent(issuesPath, 'issues') || 
             jsonFileHasContent(issuesPath, 'issues_list');
    }
  }
];

// ============================================================================
// MAIN RECONCILIATION FUNCTION
// ============================================================================

/**
 * Reconcile project status with file reality
 * 
 * This function should be called when loading a project to ensure
 * the stored status matches what files actually exist.
 * 
 * @param projectId - The project ID to reconcile
 * @returns ReconciliationResult with details of any drift detected
 */
export function reconcileProjectStatus(projectId: string): ReconciliationResult {
  const result: ReconciliationResult = {
    hadDrift: false,
    driftDetails: [],
    status: null as any
  };
  
  // Read current status
  const status = readProjectStatus(projectId);
  
  if (!status) {
    logger.debug(`[Reconciliation] No status file found for ${projectId}, skipping reconciliation`);
    return result;
  }
  
  result.status = status;
  let statusModified = false;
  
  logger.debug(`\n🔄 [Reconciliation] Checking ${projectId} for status drift...`);
  
  // Check each rule
  for (const rule of RECONCILIATION_RULES) {
    const agentStatus = status.agents[rule.agent];
    const phaseData = agentStatus.phases[rule.phase];
    
    // Only check if the phase is marked as complete
    if (phaseData?.status === 'complete') {
      const filesOk = rule.filesExist(projectId);
      
      if (!filesOk) {
        // DRIFT DETECTED: Status says complete, but files don't support it
        logger.debug(`⚠️  [Reconciliation] Drift detected: ${rule.id}`);
        logger.debug(`   Rule: ${rule.description}`);
        logger.debug(`   Stored: complete → Fixing to: not-started`);
        
        // Record the drift
        result.hadDrift = true;
        result.driftDetails.push({
          ruleId: rule.id,
          description: rule.description,
          storedStatus: 'complete',
          fixedTo: 'not-started'
        });
        
        // Fix the drift: downgrade phase to not-started
        phaseData.status = 'not-started';
        delete phaseData.completedAt;
        
        // Also reset agent-level completion if needed
        if (agentStatus.status === 'complete') {
          agentStatus.status = 'not-started';
          delete agentStatus.completedAt;
        }
        
        // Update current phase if this was the current phase
        const fullPhaseName = `${rule.agent}-${rule.phase}`;
        if (status.currentPhase === fullPhaseName || 
            isPhaseAfter(status.currentPhase, fullPhaseName)) {
          // Revert to the generate phase
          status.currentPhase = fullPhaseName;
          status.currentAgent = rule.agent;
          agentStatus.currentPhase = rule.phase;
        }
        
        statusModified = true;
      }
    }
  }
  
  // Write back if modified
  if (statusModified) {
    status.lastUpdatedAt = new Date().toISOString();
    writeProjectStatus(projectId, status);
    
    logger.debug(`\n✅ [Reconciliation] Status repaired with ${result.driftDetails.length} fix(es)`);
  } else {
    logger.debug(`✅ [Reconciliation] No drift detected, status is consistent`);
  }
  
  result.status = status;
  return result;
}

/**
 * Check if phase A comes after phase B in the workflow
 */
function isPhaseAfter(phaseA: string, phaseB: string): boolean {
  const phaseOrder = [
    'pm-questions-generate',
    'pm-questions-answer',
    'pm-prd-generate',
    'pm-prd-review',
    'ux-questions-generate',
    'ux-questions-answer',
    'ux-design-brief-generate',
    'ux-design-brief-review',
    'engineer-questions-generate',
    'engineer-questions-answer',
    'engineer-spec-generate',
    'engineer-spec-review',
    'complete'
  ];
  
  const indexA = phaseOrder.indexOf(phaseA);
  const indexB = phaseOrder.indexOf(phaseB);
  
  if (indexA === -1 || indexB === -1) {
    return false;
  }
  
  return indexA > indexB;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get reconciled project status (read + reconcile in one call)
 * 
 * Use this instead of readProjectStatus() when loading a project
 * to ensure status is always consistent with file reality.
 */
export function getReconciledProjectStatus(projectId: string): ProjectStatus | null {
  const result = reconcileProjectStatus(projectId);
  return result.status;
}

/**
 * Check if a project has any status drift without fixing it
 * 
 * Useful for diagnostics and reporting.
 */
export function checkForDrift(projectId: string): { hasDrift: boolean; issues: string[] } {
  const status = readProjectStatus(projectId);
  
  if (!status) {
    return { hasDrift: false, issues: [] };
  }
  
  const issues: string[] = [];
  
  for (const rule of RECONCILIATION_RULES) {
    const agentStatus = status.agents[rule.agent];
    const phaseData = agentStatus.phases[rule.phase];
    
    if (phaseData?.status === 'complete') {
      const filesOk = rule.filesExist(projectId);
      
      if (!filesOk) {
        issues.push(`${rule.id}: ${rule.description}`);
      }
    }
  }
  
  return {
    hasDrift: issues.length > 0,
    issues
  };
}

/**
 * Get all reconciliation rules (for debugging/testing)
 */
export function getReconciliationRules(): ReconciliationRule[] {
  return [...RECONCILIATION_RULES];
}

