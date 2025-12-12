/**
 * Project Path Utilities
 * 
 * Centralized path management for all project files and folders.
 * This ensures consistency and makes path changes easy to maintain.
 * 
 * PROJECT STRUCTURE:
 * projects/
 *   {project-id}/
 *     project_request.md
 *     project_status.json          <- Contains workflow status AND settings
 *     questions/
 *       pm_questions.json
 *       ux_questions.json
 *       engineer_questions.json
 *     documents/
 *       technology_choices.json
 *       prd.md                     <- Product Requirements Document
 *       design_brief.md
 *       screens.json
 *       technical_specification.md
 *     issues/
 *       issues.json       <- All issues inline (no separate .md files)
 */

import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';

/**
 * Get the base project directory path
 */
export function getProjectPath(projectId: string): string {
  return path.join(OUTPUT_DIR, 'projects', projectId);
}

/**
 * Get the questions folder path
 */
export function getQuestionsDir(projectId: string): string {
  return path.join(getProjectPath(projectId), 'questions');
}

/**
 * Get the documents folder path
 */
export function getDocumentsDir(projectId: string): string {
  return path.join(getProjectPath(projectId), 'documents');
}

/**
 * Get the issues folder path
 */
export function getIssuesDir(projectId: string): string {
  return path.join(getProjectPath(projectId), 'issues');
}

// ============================================================
// ROOT LEVEL FILES
// ============================================================

export function getProjectRequestPath(projectId: string): string {
  return path.join(getProjectPath(projectId), 'project_request.md');
}

export function getProjectStatusPath(projectId: string): string {
  return path.join(getProjectPath(projectId), 'project_status.json');
}

/**
 * @deprecated Settings are now stored in project_status.json
 * This function is kept for backward compatibility with existing project_config.json files
 */
export function getProjectConfigPath(projectId: string): string {
  return path.join(getProjectPath(projectId), 'project_config.json');
}

// ============================================================
// QUESTIONS FILES (in questions/ folder)
// ============================================================

export function getPMQuestionsPath(projectId: string): string {
  return path.join(getQuestionsDir(projectId), 'pm_questions.json');
}

export function getUXQuestionsPath(projectId: string): string {
  return path.join(getQuestionsDir(projectId), 'ux_questions.json');
}

export function getEngineerQuestionsPath(projectId: string): string {
  return path.join(getQuestionsDir(projectId), 'engineer_questions.json');
}

export function getTechnologyChoicesPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'technology_choices.json');
}

// ============================================================
// PM FILES (in pm/ folder)
// ============================================================

export function getPMDir(projectId: string): string {
  return path.join(getProjectPath(projectId), 'pm');
}

export function getAcceptanceCriteriaPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'acceptance_criteria.json');
}

// ============================================================
// DOCUMENT FILES (in documents/ folder)
// ============================================================

export function getPRDPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'prd.md');
}

export function getDesignBriefPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'design_brief.md');
}

/**
 * @deprecated Wireframes are now part of design_brief.md. This function is kept for backward compatibility.
 */
export function getWireframesPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'design_brief.md');
}

export function getScreensPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'screens.json');
}

export function getTechnicalSpecPath(projectId: string): string {
  return path.join(getDocumentsDir(projectId), 'technical_specification.md');
}

// ============================================================
// ISSUES FILES (in issues/ folder)
// ============================================================

/**
 * Get the canonical path for project summaries (issues/)
 */
export function getProjectSummaryPath(projectId: string): string {
  return path.join(getIssuesDir(projectId), 'issues.json');
}

export function getIssuePath(projectId: string, issueId: string): string {
  return path.join(getIssuesDir(projectId), `${issueId}.md`);
}

// ============================================================
// RELATIVE PATHS FOR CURSOR @ REFERENCES
// ============================================================

/**
 * Convert absolute path to relative path from workspace root (process.cwd())
 * This ensures @ references work correctly in Cursor regardless of workspace location
 */
export function toRelativePath(absolutePath: string): string {
  const relativePath = path.relative(process.cwd(), absolutePath);
  return relativePath;
}

/**
 * Get a relative path for Cursor @ reference
 */
export function getRelativeProjectPath(projectId: string, relativePath: string): string {
  const absolutePath = path.join(getProjectPath(projectId), relativePath);
  return `@${toRelativePath(absolutePath)}`;
}

// ============================================================
// LEGACY COMPATIBILITY HELPERS
// ============================================================
// These help during migration - they map old paths to new paths

/**
 * Map old path pattern to new path
 * This helps during migration and should be removed once refactoring is complete
 */
export function mapLegacyPath(projectId: string, legacyPath: string): string {
  // Handle pm/* paths
  if (legacyPath.startsWith('pm/pm_questions.json')) {
    return getPMQuestionsPath(projectId);
  }
  
  // Handle ux/* paths
  if (legacyPath.startsWith('ux/ux_questions.json')) {
    return getUXQuestionsPath(projectId);
  }
  
  // Handle engineer/* paths
  if (legacyPath.startsWith('engineer/engineer_questions.json')) {
    return getEngineerQuestionsPath(projectId);
  }
  if (legacyPath.startsWith('engineer/technology_choices.json')) {
    return getTechnologyChoicesPath(projectId);
  }
  
  // Handle root document paths
  if (legacyPath === 'product_requirements_document.md' || legacyPath === 'prd.md') {
    return getPRDPath(projectId);
  }
  if (legacyPath === 'design_brief.md') {
    return getDesignBriefPath(projectId);
  }
  if (legacyPath === 'technical_specification.md') {
    return getTechnicalSpecPath(projectId);
  }
  
  // If no mapping found, return as-is (joined with project path)
  return path.join(getProjectPath(projectId), legacyPath);
}

// ============================================================
// HELPER FOR DOCUMENT TYPE MAPPING
// ============================================================

/**
 * Map document type to file path
 * Used by API endpoints that accept documentType parameter
 */
export function getDocumentPathByType(projectId: string, documentType: string): string | null {
  const typeMap: { [key: string]: string } = {
    'prd': getPRDPath(projectId),
    'design': getDesignBriefPath(projectId),
    'screens': getScreensPath(projectId),
    'tech': getTechnicalSpecPath(projectId),
    'tech-spec': getTechnicalSpecPath(projectId),
  };
  
  return typeMap[documentType] || null;
}

/**
 * Get the relative path for a document file (for display/UI purposes)
 * Returns path relative to project root
 */
export function getRelativeDocumentPath(documentType: string): string {
  const pathMap: { [key: string]: string } = {
    'prd': 'documents/prd.md',
    'design': 'documents/design_brief.md',
    'screens': 'documents/screens.json',
    'tech': 'documents/technical_specification.md',
    'tech-spec': 'documents/technical_specification.md',
    'pm-questions': 'questions/pm_questions.json',
    'ux-questions': 'questions/ux_questions.json',
    'engineer-questions': 'questions/engineer_questions.json',
    'technology-choices': 'documents/technology_choices.json',
  };
  
  return pathMap[documentType] || documentType;
}

