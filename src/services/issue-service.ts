/**
 * Issue Service - Issue operations and management
 * 
 * This module contains functions for parsing, updating, and managing issues within projects.
 * Issues are now stored entirely in issues.json (no separate .md files).
 */

import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config/constants.js';
import type { IssueMetadata, AcceptanceCriterion } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ParsedIssue {
    id: string;
    issueId: string;
    title: string;
    status: 'pending' | 'in-review' | 'approved';
    estimatedHours: number;
    description: string;
    dependencies: string[];
    // Traceability fields
    screensAffected?: string[];
    // Issue content
    keyDecisions: string[];
    acceptanceCriteria: AcceptanceCriterion[];  // Objects with id and description
    technicalDetails: string | null;
    testStrategy: {
        automated_tests: string;
        manual_verification: string;
    };
    humanInTheLoop: string[];
    projectId: string;
    // Legacy fields for backward compatibility
    coversAcceptanceCriteria?: string[];  // Deprecated: used for reading old data
    coversScreens?: string[];             // Deprecated: used for reading old data
    category?: 'frontend' | 'backend' | 'database' | 'testing' | 'devops';
    complexityScore?: number;
    complexityReasoning?: string;
    subtasks?: string;
    notes?: string;
    implementationNotes?: string;
    filePath?: string;
}

/**
 * Interface for the issues.json structure
 */
interface ProjectSummary {
    project_name: string;
    project_id: string;
    total_estimated_hours: number;
    total_issues: number;
    generated_at: string;
    issues_by_complexity?: {
        low: number;
        medium: number;
        high: number;
    };
    issues: IssueInSummary[];
    // Legacy field name for backward compatibility
    issues_list?: IssueInSummary[];
    definition_of_done: string[];
}

interface IssueInSummary {
    issue_id: string;
    title: string;
    status: 'pending' | 'in-review' | 'approved';
    estimated_hours: number;
    dependencies: string[];
    description: string;
    key_decisions?: string[];
    // New format: array of objects with id and description
    acceptance_criteria?: Array<{ id: string; description: string } | string>;
    screens_affected?: string[];
    technical_details?: string | null;
    testing_strategy?: {
        automated_tests?: string;
        manual_verification?: string;
    };
    // Legacy field name
    test_strategy?: {
        automated_tests?: string;
        manual_verification?: string;
    };
    human_in_the_loop?: string[];
    // Legacy fields
    covers_acceptance_criteria?: string[];
    covers_screens?: string[];
    category?: string;
    complexity?: number;
    file_path?: string;
}

/**
 * Get the path to issues.json for a project
 * Canonical location: issues/issues.json
 */
const getProjectSummaryPath = (projectId: string): string => {
    const projectsDir = path.join(OUTPUT_DIR, 'projects');
    
    // Find the actual project folder (could be "002" or "002-project-name")
    if (fs.existsSync(projectsDir)) {
        const projectFolders = fs.readdirSync(projectsDir);
        const matchingFolder = projectFolders.find(f => 
            f === projectId || f.startsWith(`${projectId}-`)
        );
        
        if (matchingFolder) {
            return path.join(projectsDir, matchingFolder, 'issues', 'issues.json');
        }
    }
    
    return path.join(projectsDir, projectId, 'issues', 'issues.json');
};

/**
 * Load project summary from JSON file
 */
const loadProjectSummary = (projectId: string): ProjectSummary | null => {
    const summaryPath = getProjectSummaryPath(projectId);
    
    if (!fs.existsSync(summaryPath)) {
        return null;
    }
    
    try {
        const content = fs.readFileSync(summaryPath, 'utf-8');
        return JSON.parse(content) as ProjectSummary;
    } catch (error) {
        logger.error(`Error loading project summary for ${projectId}:`, error);
        return null;
    }
};

/**
 * Save project summary to JSON file
 */
const saveProjectSummary = (projectId: string, summary: ProjectSummary): boolean => {
    const summaryPath = getProjectSummaryPath(projectId);
    
    try {
        // Ensure directory exists
        const dir = path.dirname(summaryPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
        return true;
    } catch (error) {
        logger.error(`Error saving project summary for ${projectId}:`, error);
        return false;
    }
};

/**
 * Normalize acceptance criteria to new format (array of objects with id and description)
 * Handles both legacy format (strings) and new format (objects)
 */
const normalizeAcceptanceCriteria = (criteria: Array<{ id: string; description: string } | string> | undefined): AcceptanceCriterion[] => {
    if (!criteria || criteria.length === 0) return [];
    
    return criteria.map((ac, index) => {
        if (typeof ac === 'string') {
            // Legacy format: plain string, generate placeholder ID
            return { id: `ac_${index + 1}`, description: ac };
        }
        // New format: object with id and description
        return { id: ac.id, description: ac.description };
    });
};

/**
 * Convert an issue from summary format to ParsedIssue format
 */
const convertToParseIssue = (issue: IssueInSummary, projectId: string): ParsedIssue => {
    // Handle both new (testing_strategy) and legacy (test_strategy) field names
    const testStrategy = issue.testing_strategy || issue.test_strategy || {};
    
    // Handle both new (screens_affected) and legacy (covers_screens) field names
    const screensAffected = issue.screens_affected || issue.covers_screens || [];
    
    return {
        id: issue.issue_id,
        issueId: issue.issue_id,
        title: issue.title,
        status: issue.status || 'pending',
        estimatedHours: issue.estimated_hours || 0,
        description: issue.description || '',
        dependencies: issue.dependencies || [],
        // Traceability fields (new format)
        screensAffected,
        // Issue content
        keyDecisions: issue.key_decisions || [],
        acceptanceCriteria: normalizeAcceptanceCriteria(issue.acceptance_criteria),
        technicalDetails: issue.technical_details || null,
        testStrategy: {
            automated_tests: testStrategy.automated_tests || 'none',
            manual_verification: testStrategy.manual_verification || ''
        },
        humanInTheLoop: issue.human_in_the_loop || [],
        projectId,
        // Legacy fields (for backward compatibility reading old data)
        coversAcceptanceCriteria: issue.covers_acceptance_criteria,
        coversScreens: issue.covers_screens,
        category: issue.category as any,
        complexityScore: issue.complexity,
        filePath: issue.file_path
    };
};

/**
 * Get all issues for a project from issues.json
 */
export const getProjectIssues = (projectId: string): ParsedIssue[] => {
    const summary = loadProjectSummary(projectId);
    
    if (!summary) {
        return [];
    }
    
    // Handle both new (issues) and legacy (issues_list) field names
    const issuesList = summary.issues || summary.issues_list || [];
    
    return issuesList.map(issue => convertToParseIssue(issue, projectId));
};

/**
 * Get a single issue by ID
 */
export const getIssueById = (projectId: string, issueId: string): ParsedIssue | null => {
    const issues = getProjectIssues(projectId);
    return issues.find(issue => issue.issueId === issueId) || null;
};

/**
 * Get issues filtered by status
 */
export const getIssuesByStatus = (projectId: string, status: 'pending' | 'in-review' | 'approved'): ParsedIssue[] => {
    const allIssues = getProjectIssues(projectId);
    return allIssues.filter(issue => issue.status === status);
};

/**
 * Update issue status in issues.json
 */
export const updateIssueStatus = (projectId: string, issueId: string, newStatus: 'pending' | 'in-review' | 'approved'): boolean => {
    const summary = loadProjectSummary(projectId);
    
    if (!summary) {
        logger.error(`Project summary not found for ${projectId}`);
        return false;
    }
    
    // Handle both new (issues) and legacy (issues_list) field names
    const issuesList = summary.issues || summary.issues_list || [];
    const issueIndex = issuesList.findIndex(i => i.issue_id === issueId);
    
    if (issueIndex === -1) {
        logger.error(`Issue ${issueId} not found in project ${projectId}`);
        return false;
    }
    
    issuesList[issueIndex].status = newStatus;
    
    // Update the correct field
    if (summary.issues) {
        summary.issues = issuesList;
    } else {
        summary.issues_list = issuesList;
    }
    
    return saveProjectSummary(projectId, summary);
};

/**
 * Check if all dependencies for an issue are satisfied (all approved)
 */
export const areDependenciesSatisfied = (issue: ParsedIssue, allIssues: ParsedIssue[]): boolean => {
    if (issue.dependencies.length === 0) {
        return true; // No dependencies
    }
    
    for (const depId of issue.dependencies) {
        const depIssue = allIssues.find(i => i.issueId === depId);
        if (!depIssue || depIssue.status !== 'approved') {
            return false; // Dependency not found or not approved
        }
    }
    
    return true;
};

/**
 * Resolve dependencies and find issues that are ready to work on
 */
export const getReadyIssues = (projectId: string): ParsedIssue[] => {
    const allIssues = getProjectIssues(projectId);
    const pendingIssues = allIssues.filter(issue => issue.status === 'pending');
    
    return pendingIssues.filter(issue => areDependenciesSatisfied(issue, allIssues));
};

/**
 * Get the next issue to work on (first ready issue with pending status)
 */
export const getNextIssue = (projectId: string): ParsedIssue | null => {
    const readyIssues = getReadyIssues(projectId);
    return readyIssues.length > 0 ? readyIssues[0] : null;
};

/**
 * Get issue counts by status for a project
 */
export const getIssueStatusCounts = (projectId: string): { pending: number; inReview: number; approved: number; total: number } => {
    const allIssues = getProjectIssues(projectId);
    
    return {
        pending: allIssues.filter(i => i.status === 'pending').length,
        inReview: allIssues.filter(i => i.status === 'in-review').length,
        approved: allIssues.filter(i => i.status === 'approved').length,
        total: allIssues.length
    };
};

/**
 * Find an issue by ID across all projects
 */
export const findIssueById = (issueId: string): { issue: ParsedIssue; projectId: string } | null => {
    const projectsDir = path.join(OUTPUT_DIR, 'projects');
    
    if (!fs.existsSync(projectsDir)) {
        return null;
    }
    
    const projectDirs = fs.readdirSync(projectsDir)
        .filter(name => /^\d{3}(-.*)?$/.test(name));
    
    for (const projectDirName of projectDirs) {
        const projectId = projectDirName.split('-')[0];
        const issues = getProjectIssues(projectId);
        const issue = issues.find(i => i.issueId === issueId);
        
        if (issue) {
            return { issue, projectId };
        }
    }
    
    return null;
};

/**
 * Get the project summary for a project
 */
export const getProjectSummary = (projectId: string): ProjectSummary | null => {
    return loadProjectSummary(projectId);
};

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// These functions maintain backward compatibility with code expecting .md files
// ============================================================================

/**
 * @deprecated Use getIssueById instead
 * Parse an individual issue file (ENG-XXX.md) - Legacy compatibility
 */
export const parseIssueFile = (filePath: string, projectId: string): ParsedIssue | null => {
    // Extract issue ID from file path
    const issueId = path.basename(filePath, '.md');
    return getIssueById(projectId, issueId);
};

/**
 * @deprecated Status is now updated in JSON
 * Legacy function - status updates go to JSON now
 */
export const updateIssueStatusByPath = (filePath: string, newStatus: 'pending' | 'in-review' | 'approved'): boolean => {
    // Extract project ID and issue ID from path
    // Path format: .../projects/{projectId}/issues/{issueId}.md
    const parts = filePath.split(path.sep);
    const projectsIndex = parts.findIndex(p => p === 'projects');
    
    if (projectsIndex === -1 || projectsIndex + 1 >= parts.length) {
        logger.error(`Could not extract project ID from path: ${filePath}`);
        return false;
    }
    
    const projectFolder = parts[projectsIndex + 1];
    const projectId = projectFolder.split('-')[0];
    const issueId = path.basename(filePath, '.md');
    
    return updateIssueStatus(projectId, issueId, newStatus);
};

/**
 * @deprecated Feedback should be handled differently with JSON-only approach
 * Add review feedback to an issue
 */
export const addReviewFeedback = (filePath: string, feedback: string): boolean => {
    logger.warn('addReviewFeedback is deprecated - feedback handling needs to be reimplemented for JSON-only approach');
    return false;
};
