/**
 * Cost Tracking Service
 * 
 * Simplified cost tracking for AI specification workflows.
 * 
 * Input tokens: Running total, added when each prompt is generated
 * Output tokens: Calculated on-demand by scanning all output files, cached
 */

import fs from 'fs';
import path from 'path';
import { encode } from 'gpt-3-encoder';
import { OUTPUT_DIR, SQUAD_DIR } from '../config/constants.js';
import { loadSettings, type ModelTier } from './settings-service.js';
import { readProjectStatus, writeProjectStatus } from './status-service.js';
import type { CostTracking } from '../types/project-status.js';
import {
  type CostEstimate,
  calculateCost,
  formatCost,
  formatTokens,
  DEFAULT_TIER
} from '../utils/cost-estimation.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Token Counting Utilities
// ============================================================================

/**
 * Parse @file references from prompt text
 */
function parseFileReferences(text: string): string[] {
  const fileReferenceRegex = /@([^\s\n]+)/g;
  const matches: string[] = [];
  let match;
  
  while ((match = fileReferenceRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

/**
 * Read file content safely
 */
function readFileContent(filePath: string): string {
  try {
    // Try relative to SQUAD_DIR first (for specwright files)
    const squadPath = path.resolve(SQUAD_DIR, filePath);
    if (fs.existsSync(squadPath)) {
      return fs.readFileSync(squadPath, 'utf-8');
    }
    
    // Try as absolute path
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    
    return '';
  } catch {
    return '';
  }
}

/**
 * Count tokens in a prompt including referenced files
 */
export function countPromptTokens(promptContent: string): number {
  try {
    let totalContent = promptContent;
    
    // Parse and include @file references
    const fileReferences = parseFileReferences(promptContent);
    for (const fileRef of fileReferences) {
      const fileContent = readFileContent(fileRef);
      if (fileContent) {
        totalContent += '\n\n' + fileContent;
      }
    }
    
    const tokens = encode(totalContent);
    return tokens.length;
  } catch {
    // Fallback: rough estimate (4 chars per token)
    return Math.ceil(promptContent.length / 4);
  }
}

/**
 * Count tokens in a file
 */
export function countFileTokens(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) return 0;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const tokens = encode(content);
    return tokens.length;
  } catch {
    return 0;
  }
}

/**
 * Get the latest modification time of any file in a directory (recursive)
 */
function getLatestModTime(dirPath: string): Date | null {
  try {
    if (!fs.existsSync(dirPath)) return null;
    
    let latestTime: Date | null = null;
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subDirTime = getLatestModTime(fullPath);
        if (subDirTime && (!latestTime || subDirTime > latestTime)) {
          latestTime = subDirTime;
        }
      } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.md'))) {
        const stats = fs.statSync(fullPath);
        if (!latestTime || stats.mtime > latestTime) {
          latestTime = stats.mtime;
        }
      }
    }
    
    return latestTime;
  } catch {
    return null;
  }
}

/**
 * Count all tokens in a directory (recursive, .json and .md files only)
 */
function countTokensInDir(dirPath: string): number {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    
    let totalTokens = 0;
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        totalTokens += countTokensInDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.md'))) {
        totalTokens += countFileTokens(fullPath);
      }
    }
    
    return totalTokens;
  } catch {
    return 0;
  }
}

/**
 * Calculate total output tokens for a project by scanning all output files
 */
function calculateProjectOutputTokens(projectId: string): number {
  const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
  
  if (!fs.existsSync(projectPath)) return 0;
  
  let totalTokens = 0;
  
  // Scan questions folder
  const questionsDir = path.join(projectPath, 'questions');
  totalTokens += countTokensInDir(questionsDir);
  
  // Scan documents folder
  const documentsDir = path.join(projectPath, 'documents');
  totalTokens += countTokensInDir(documentsDir);
  
  // Scan issues folder
  const issuesDir = path.join(projectPath, 'issues');
  totalTokens += countTokensInDir(issuesDir);
  
  return totalTokens;
}

/**
 * Check if output files have been modified since last calculation
 */
function outputFilesModifiedSince(projectId: string, lastCalculated: string): boolean {
  const projectPath = path.join(OUTPUT_DIR, 'projects', projectId);
  
  if (!fs.existsSync(projectPath)) return false;
  
  const lastCalcDate = new Date(lastCalculated);
  
  // Check each output directory
  const dirsToCheck = ['questions', 'documents', 'issues'];
  
  for (const dir of dirsToCheck) {
    const dirPath = path.join(projectPath, dir);
    const latestModTime = getLatestModTime(dirPath);
    
    if (latestModTime && latestModTime > lastCalcDate) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Cost Data Management (via status.json)
// ============================================================================

/**
 * Get cost tracking data from project status
 */
function getCostTracking(projectId: string): CostTracking | null {
  const status = readProjectStatus(projectId);
  if (!status) return null;
  return status.costTracking || null;
}

/**
 * Initialize cost tracking for a project with the new simplified structure
 */
function initializeCostTracking(): CostTracking {
  const settings = loadSettings();
  const tier = settings.costEstimation?.tier || DEFAULT_TIER;
  
  return {
    tier,
    totalInputTokens: 0,
    cachedOutputTokens: 0,
    outputCalculatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Migrate legacy per-phase tracking to new simplified structure
 */
function migrateLegacyCostTracking(legacy: CostTracking): CostTracking {
  // If already in new format, return as-is
  if (typeof legacy.totalInputTokens === 'number') {
    return legacy;
  }
  
  // Migrate from legacy per-phase format
  let totalInput = 0;
  
  if (legacy.phases && Array.isArray(legacy.phases)) {
    for (const phase of legacy.phases) {
      totalInput += phase.inputTokens || 0;
    }
  }
  
  const settings = loadSettings();
  
  return {
    tier: legacy.tier || settings.costEstimation?.tier || DEFAULT_TIER,
    totalInputTokens: totalInput,
    cachedOutputTokens: 0, // Will be recalculated on first getCostSummary
    outputCalculatedAt: '', // Empty means needs recalculation
    lastUpdated: legacy.lastUpdated || new Date().toISOString(),
    phases: legacy.phases // Keep for backwards compatibility
  };
}

/**
 * Get or create cost tracking data, migrating if necessary
 */
function getOrCreateCostTracking(projectId: string): CostTracking {
  const existing = getCostTracking(projectId);
  
  if (existing) {
    // Migrate legacy format if needed
    const migrated = migrateLegacyCostTracking(existing);
    
    // Update tier from settings in case it changed
    const settings = loadSettings();
    migrated.tier = settings.costEstimation?.tier || migrated.tier;
    
    return migrated;
  }
  
  return initializeCostTracking();
}

/**
 * Save cost tracking data to project status
 */
function saveCostTracking(projectId: string, costTracking: CostTracking): void {
  const status = readProjectStatus(projectId);
  if (!status) {
    logger.error(`Cannot save cost tracking: project ${projectId} not found`);
    return;
  }
  
  costTracking.lastUpdated = new Date().toISOString();
  status.costTracking = costTracking;
  writeProjectStatus(projectId, status);
}

// ============================================================================
// Input Token Recording
// ============================================================================

/**
 * Add input tokens to the running total (called when prompt is generated)
 */
export function addInputTokens(projectId: string, inputTokens: number): void {
  const costTracking = getOrCreateCostTracking(projectId);
  
  costTracking.totalInputTokens = (costTracking.totalInputTokens || 0) + inputTokens;
  
  logger.debug(`💰 [Cost] Added ${formatTokens(inputTokens)} input tokens (total: ${formatTokens(costTracking.totalInputTokens)})`);
  
  saveCostTracking(projectId, costTracking);
}

/**
 * @deprecated Use addInputTokens instead
 * Kept for backwards compatibility during transition
 */
export function recordPhaseInput(
  projectId: string,
  _phase: string,
  inputTokens: number
): void {
  addInputTokens(projectId, inputTokens);
}

/**
 * @deprecated No longer needed - output tokens are calculated on-demand
 */
export function recordPhaseOutput(
  _projectId: string,
  _phase: string,
  _outputTokens: number
): null {
  // No-op: output tokens are now calculated on-demand
  return null;
}

// ============================================================================
// Cost Queries
// ============================================================================

/**
 * Get output tokens, using cache if valid or recalculating if needed
 */
function getOutputTokens(projectId: string, costTracking: CostTracking): { tokens: number; recalculated: boolean } {
  const needsRecalculation = 
    !costTracking.outputCalculatedAt ||
    costTracking.outputCalculatedAt === '' ||
    outputFilesModifiedSince(projectId, costTracking.outputCalculatedAt);
  
  if (needsRecalculation) {
    const tokens = calculateProjectOutputTokens(projectId);
    logger.debug(`💰 [Cost] Recalculated output tokens: ${formatTokens(tokens)}`);
    return { tokens, recalculated: true };
  }
  
  return { tokens: costTracking.cachedOutputTokens || 0, recalculated: false };
}

/**
 * Get full cost estimate for a project
 */
export function getProjectCostEstimate(projectId: string): CostEstimate | null {
  const costTracking = getOrCreateCostTracking(projectId);
  
  const { tokens: outputTokens } = getOutputTokens(projectId, costTracking);
  
  return calculateCost(
    costTracking.totalInputTokens || 0,
    outputTokens,
    costTracking.tier
  );
}

/**
 * Cost summary for UI display
 */
export interface CostSummary {
  enabled: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tier: ModelTier;
  tierName: string;
  formatted: {
    inputTokens: string;
    outputTokens: string;
    inputCost: string;
    outputCost: string;
    totalCost: string;
  };
}

/**
 * Get formatted cost summary for UI display
 */
export function getCostSummary(projectId: string): CostSummary | null {
  const settings = loadSettings();
  
  if (!settings.costEstimation?.enabled) {
    return null;
  }
  
  const costTracking = getOrCreateCostTracking(projectId);
  
  // Get output tokens (cached or recalculated)
  const { tokens: outputTokens, recalculated } = getOutputTokens(projectId, costTracking);
  
  // If we recalculated, update the cache
  if (recalculated) {
    costTracking.cachedOutputTokens = outputTokens;
    costTracking.outputCalculatedAt = new Date().toISOString();
    saveCostTracking(projectId, costTracking);
  }
  
  const inputTokens = costTracking.totalInputTokens || 0;
  const estimate = calculateCost(inputTokens, outputTokens, costTracking.tier);
  
  // Determine tier name
  const tierName = costTracking.tier === 'budget' 
    ? 'Budget Models' 
    : costTracking.tier === 'premium' 
      ? 'Premium Models' 
      : 'Standard Models';
  
  return {
    enabled: true,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    inputCost: estimate.inputCost,
    outputCost: estimate.outputCost,
    totalCost: estimate.totalCost,
    tier: costTracking.tier,
    tierName,
    formatted: {
      inputTokens: formatTokens(inputTokens),
      outputTokens: formatTokens(outputTokens),
      inputCost: formatCost(estimate.inputCost),
      outputCost: formatCost(estimate.outputCost),
      totalCost: formatCost(estimate.totalCost)
    }
  };
}

/**
 * Check if cost estimation is enabled
 */
export function isCostEstimationEnabled(): boolean {
  const settings = loadSettings();
  return settings.costEstimation?.enabled ?? true;
}

/**
 * Force recalculation of output tokens for a project
 * Useful after file watcher detects changes
 */
export function invalidateOutputTokenCache(projectId: string): void {
  const costTracking = getCostTracking(projectId);
  if (!costTracking) return;
  
  // Set to empty to force recalculation on next getCostSummary
  costTracking.outputCalculatedAt = '';
  saveCostTracking(projectId, costTracking);
}
